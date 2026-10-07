import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';
import AdmZip from 'adm-zip';
import crypto from 'node:crypto';
import {
  safeRelative,
  validateManifest,
  extractSafe,
  commitInstall,
  installRelease,
  fetchManifest,
  fetchServers,
  validateServers,
  visibleServers,
  readSigned,
  staleServerListMs,
  releaseInfo,
  recover,
  exists,
  hashFile,
  listFiles,
  validateFileList,
  downloadTo,
} from '../extension/src/updater';
import { temporary, removeTemporary, put, release, zipBytes } from './fixtures';
let dir: string;
let game: string;
let stage: string;
let cache: string;
beforeEach(async () => {
  dir = await temporary();
  game = path.join(dir, 'Game with spaces & symbols');
  stage = path.join(dir, 'stage');
  cache = path.join(dir, 'cache');
  await put(game, 'valheim.exe');
  await put(stage, 'BepInEx/core/BepInEx.dll', 'new-core');
  await put(stage, 'winhttp.dll', 'new-loader');
});
afterEach(async () => {
  await removeTemporary(dir);
});
describe('archive boundaries', () => {
  it.each([
    '../escaped',
    'a/../../escaped',
    '/absolute',
    'C:/file',
    'C:file',
    '\\server\\share',
    'a\\..\\b',
    'a//b',
    'a/./b',
    'NUL',
    'aux.txt',
    'COM1.dll',
    'file:stream',
    'a.',
    'a ',
    'a\u0000b',
    'a?b',
    'a|b',
    '',
  ])('rejects unsafe path %j', (name) => {
    expect(() => safeRelative(name)).toThrow();
  });
  it.each(['BepInEx/core/test.dll', 'config/mod.cfg', '日本語/мод.dll'])(
    'accepts ordinary paths %s',
    (name) => expect(safeRelative(name)).toBe(name),
  );
  it('normalizes directory separators', () => expect(safeRelative('a\\b/')).toBe('a/b'));
  it('extracts a real zip with CRC checks', async () => {
    const file = path.join(dir, 'good.zip');
    await fs.writeFile(file, zipBytes({ 'nested/file.txt': 'hello' }));
    await extractSafe(file, path.join(dir, 'extracted'));
    expect(await fs.readFile(path.join(dir, 'extracted/nested/file.txt'), 'utf8')).toBe('hello');
  });
  it('rejects traversal encoded in an actual ZIP before writing any file', async () => {
    // Patch equal-length names in both local and central headers; addFile sanitizes traversal.
    const bytes = zipBytes({ 'xx/evil.txt': 'bad', 'safe.txt': 'safe' });
    const malicious = Buffer.from(bytes);
    let offset = 0;
    while ((offset = malicious.indexOf('xx/evil.txt', offset)) !== -1) {
      malicious.write('../evil.txt', offset);
      offset += 11;
    }
    const file = path.join(dir, 'bad.zip');
    await fs.writeFile(file, malicious);
    await expect(extractSafe(file, path.join(dir, 'out'))).rejects.toThrow('Unsafe');
    expect(await exists(path.join(dir, 'evil.txt'))).toBe(false);
    expect(await exists(path.join(dir, 'out/safe.txt'))).toBe(false);
  });
  it('rejects case-insensitive collisions', async () => {
    const file = path.join(dir, 'bad.zip');
    await fs.writeFile(file, zipBytes({ 'Mod.dll': 'one', 'mod.dll': 'two' }));
    await expect(extractSafe(file, path.join(dir, 'out'))).rejects.toThrow('Duplicate');
  });
  it('rejects Unix symlinks in ZIP metadata', async () => {
    const zip = new AdmZip();
    zip.addFile('link', Buffer.from('../outside'));
    zip.getEntry('link')!.attr = (0xa1ff << 16) >>> 0;
    const file = path.join(dir, 'link.zip');
    await fs.writeFile(file, zip.toBuffer());
    await expect(extractSafe(file, path.join(dir, 'out'))).rejects.toThrow('links');
  });
  it('rejects oversized uncompressed metadata before allocation', async () => {
    const b = zipBytes({ large: 'small' });
    const central = b.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    b.writeUInt32LE(600 * 1024 ** 2, central + 24);
    const file = path.join(dir, 'large.zip');
    await fs.writeFile(file, b);
    await expect(extractSafe(file, path.join(dir, 'out'))).rejects.toThrow('limits');
  });
  it('aborts extraction', async () => {
    const file = path.join(dir, 'good.zip');
    await fs.writeFile(file, zipBytes({ a: 'x' }));
    await expect(extractSafe(file, path.join(dir, 'out'), AbortSignal.abort())).rejects.toThrow();
    expect(await exists(path.join(dir, 'out/a'))).toBe(false);
  });
});
describe('manifest trust boundary', () => {
  it('accepts a complete release', () =>
    expect(validateManifest(release().manifest, 'https://mods.example/').releaseId).toBe('r1'));
  it.each([
    (m: ReturnType<typeof release>['manifest']) => {
      m.schemaVersion = 2 as 1;
    },
    (m: ReturnType<typeof release>['manifest']) => {
      m.archives.pop();
    },
    (m: ReturnType<typeof release>['manifest']) => {
      m.archives[0].sha256 = 'bad';
    },
    (m: ReturnType<typeof release>['manifest']) => {
      m.archives[0].size = -1;
    },
    (m: ReturnType<typeof release>['manifest']) => {
      m.archives[0].size = 3 * 1024 ** 3;
    },
    (m: ReturnType<typeof release>['manifest']) => {
      m.archives[0].name = 'plugins';
    },
    (m: ReturnType<typeof release>['manifest']) => {
      m.releaseId = '../escape';
    },
  ])('rejects incomplete or malformed metadata %#', (mutate) => {
    const { manifest } = release();
    mutate(manifest);
    expect(() => validateManifest(manifest, 'https://mods.example/')).toThrow();
  });
  it.each([
    'https://evil.example/files/releases/r1/a.zip',
    '/files/BepInEx.zip',
    '/files/releases/r2/a.zip',
    'https://user:pass@mods.example/files/releases/r1/a.zip',
    'files/releases/r1/a.zip?mutable=1',
    'files/releases/r1/a.zip#x',
  ])('rejects untrusted URL %s', (url) => {
    const { manifest } = release();
    manifest.archives[0].url = url;
    expect(() => validateManifest(manifest, 'https://mods.example/')).toThrow();
  });
});
describe('transactional installation', () => {
  it('replaces a managed hard link without changing its external target', async () => {
    const external = await put(dir, 'personal-loader.dll', 'external');
    await fs.link(external, path.join(game, 'winhttp.dll'));
    await commitInstall(game, stage, 'r1');
    expect(await fs.readFile(external, 'utf8')).toBe('external');
    expect(await fs.readFile(path.join(game, 'winhttp.dll'), 'utf8')).toBe('new-loader');
  });
  it('does not duplicate backups or rewrite unchanged files on every startup', async () => {
    await commitInstall(game, stage, 'r1');
    const state = path.join(game, '.vlauncher');
    const backups = await fs.readdir(state);
    const modified = (await fs.stat(path.join(game, 'winhttp.dll'))).mtimeMs;
    await commitInstall(game, stage, 'r1');
    expect(await fs.readdir(state)).toEqual(backups);
    expect((await fs.stat(path.join(game, 'winhttp.dll'))).mtimeMs).toBe(modified);
  });
  it('backs up existing installation and removes mods the server does not run', async () => {
    await put(game, 'BepInEx/core/BepInEx.dll', 'old-core');
    await put(game, 'BepInEx/plugins/my-mod.dll', 'personal');
    await put(game, 'BepInEx/plugins/Backpacks/Backpacks.dll', 'personal');
    await put(game, 'BepInEx/patchers/my-patcher.dll', 'personal');
    await put(game, 'BepInEx/config/my-mod.cfg', 'local settings');
    await put(game, 'winhttp.dll', 'old-loader');
    await commitInstall(game, stage, 'r1');
    expect(await exists(path.join(game, 'BepInEx/plugins/my-mod.dll'))).toBe(false);
    expect(await exists(path.join(game, 'BepInEx/plugins/Backpacks'))).toBe(false);
    expect(await exists(path.join(game, 'BepInEx/patchers/my-patcher.dll'))).toBe(false);
    expect(await fs.readFile(path.join(game, 'BepInEx/config/my-mod.cfg'), 'utf8')).toBe(
      'local settings',
    );
    expect(await fs.readFile(path.join(game, 'winhttp.dll'), 'utf8')).toBe('new-loader');
    const state = path.join(game, '.vlauncher');
    const backup = (await fs.readdir(state)).find((n) => n.startsWith('backup-'))!;
    expect(await fs.readFile(path.join(state, backup, 'winhttp.dll'), 'utf8')).toBe('old-loader');
    expect(
      await fs.readFile(
        path.join(state, backup, 'BepInEx/plugins/Backpacks/Backpacks.dll'),
        'utf8',
      ),
    ).toBe('personal');
    expect(
      JSON.parse(await fs.readFile(path.join(state, 'installed.json'), 'utf8')).releaseId,
    ).toBe('r1');
    expect(await exists(path.join(state, 'journal.json'))).toBe(false);
  });
  it('removes obsolete and hand-installed plugins, keeps local configs', async () => {
    const obsolete = await put(stage, 'BepInEx/plugins/obsolete.dll', 'old');
    await commitInstall(game, stage, 'r1');
    await put(game, 'BepInEx/plugins/personal.dll', 'personal');
    await put(game, 'BepInEx/config/obsolete.cfg', 'generated by the game');
    await fs.unlink(obsolete);
    await commitInstall(game, stage, 'r2');
    expect(await exists(path.join(game, 'BepInEx/plugins/obsolete.dll'))).toBe(false);
    expect(await exists(path.join(game, 'BepInEx/plugins/personal.dll'))).toBe(false);
    expect(await exists(path.join(game, 'BepInEx/config/obsolete.cfg'))).toBe(true);
  });
  it('mirrors the config directories of server-side mods, keeps the rest of config', async () => {
    await put(stage, 'BepInEx/config/wackysDatabase/Items/sword.yml', 'release');
    await put(stage, 'BepInEx/config/EpicLoot/loottables.json', 'release');
    await put(stage, 'BepInEx/config/mod.cfg', 'release');
    await put(game, 'BepInEx/config/wackysDatabase/Items/sword.yml', 'other build');
    await put(game, 'BepInEx/config/wackysDatabase/Items/foreign.yml', 'hand-made');
    await put(game, 'BepInEx/config/wackysDatabase/Cache/items.cache', 'stale');
    await put(game, 'BepInEx/config/EpicLoot/extra/loot.json', 'hand-made');
    await put(game, 'BepInEx/config/TherzieTranslations/en.json', 'other build');
    await put(game, 'BepInEx/config/mod.cfg', 'local settings');
    await put(game, 'BepInEx/config/my-client-mod.cfg', 'local settings');
    await put(game, 'BepInEx/config/ClientMod/keys.yml', 'local settings');
    await commitInstall(game, stage, 'r1');
    const config = path.join(game, 'BepInEx/config');
    expect(await fs.readFile(path.join(config, 'wackysDatabase/Items/sword.yml'), 'utf8')).toBe(
      'release',
    );
    expect(await exists(path.join(config, 'wackysDatabase/Items/foreign.yml'))).toBe(false);
    expect(await exists(path.join(config, 'wackysDatabase/Cache'))).toBe(false);
    expect(await exists(path.join(config, 'EpicLoot/extra'))).toBe(false);
    expect(await exists(path.join(config, 'TherzieTranslations'))).toBe(false);
    expect(await fs.readFile(path.join(config, 'mod.cfg'), 'utf8')).toBe('release');
    expect(await fs.readFile(path.join(config, 'my-client-mod.cfg'), 'utf8')).toBe(
      'local settings',
    );
    expect(await fs.readFile(path.join(config, 'ClientMod/keys.yml'), 'utf8')).toBe(
      'local settings',
    );
    const state = path.join(game, '.vlauncher');
    const backup = (await fs.readdir(state)).find((n) => n.startsWith('backup-'))!;
    for (const name of [
      'wackysDatabase/Items/foreign.yml',
      'wackysDatabase/Cache/items.cache',
      'EpicLoot/extra/loot.json',
    ])
      expect(await exists(path.join(state, backup, 'BepInEx/config', name))).toBe(true);
  });
  it('drops the WackysDatabase cache only when the release changes', async () => {
    await put(stage, 'BepInEx/config/wackysDatabase/Items/sword.yml', 'release');
    await commitInstall(game, stage, 'r1');
    const cache = path.join(game, 'BepInEx/config/wackysDatabase/Cache/items.cache');
    await put(game, 'BepInEx/config/wackysDatabase/Cache/items.cache', 'built by the mod');
    await commitInstall(game, stage, 'r1');
    expect(await fs.readFile(cache, 'utf8')).toBe('built by the mod');
    await put(game, 'BepInEx/config/wackysDatabase/Items/foreign.yml', 'hand-made');
    await commitInstall(game, stage, 'r1');
    expect(await exists(path.join(game, 'BepInEx/config/wackysDatabase/Items/foreign.yml'))).toBe(
      false,
    );
    expect(await fs.readFile(cache, 'utf8')).toBe('built by the mod');
    await commitInstall(game, stage, 'r2');
    expect(await exists(path.dirname(cache))).toBe(false);
    expect(await exists(path.join(game, 'BepInEx/config/wackysDatabase/Items/sword.yml'))).toBe(
      true,
    );
  });
  it('restores files removed from a mirrored config directory when the install fails', async () => {
    await commitInstall(game, stage, 'r1');
    await put(game, 'BepInEx/config/wackysDatabase/Items/a.yml', 'hand-made a');
    await put(game, 'BepInEx/config/wackysDatabase/Items/b.yml', 'hand-made b');
    let removed = 0;
    await expect(
      commitInstall(game, stage, 'r2', undefined, (name) => {
        if (name.startsWith('BepInEx/config/wackysDatabase/') && ++removed === 2)
          throw new Error('disk failure');
      }),
    ).rejects.toThrow('disk failure');
    const items = path.join(game, 'BepInEx/config/wackysDatabase/Items');
    expect(await fs.readFile(path.join(items, 'a.yml'), 'utf8')).toBe('hand-made a');
    expect(await fs.readFile(path.join(items, 'b.yml'), 'utf8')).toBe('hand-made b');
    expect(await exists(path.join(game, '.vlauncher/journal.json'))).toBe(false);
    await commitInstall(game, stage, 'r2');
    expect(await exists(path.join(game, 'BepInEx/config/wackysDatabase'))).toBe(false);
  });
  it('cleans a hand-installed plugin even when the release did not change', async () => {
    await commitInstall(game, stage, 'r1');
    await put(game, 'BepInEx/plugins/personal.dll', 'personal');
    await commitInstall(game, stage, 'r1');
    expect(await exists(path.join(game, 'BepInEx/plugins/personal.dll'))).toBe(false);
  });
  it('rolls back after a write fails mid-install', async () => {
    await commitInstall(game, stage, 'r1');
    await put(stage, 'BepInEx/core/BepInEx.dll', 'v2');
    await put(stage, 'winhttp.dll', 'v2');
    await expect(
      commitInstall(game, stage, 'r2', undefined, (name) => {
        if (name === 'winhttp.dll') throw new Error('disk failure');
      }),
    ).rejects.toThrow('disk failure');
    expect(await fs.readFile(path.join(game, 'BepInEx/core/BepInEx.dll'), 'utf8')).toBe('new-core');
    expect(
      JSON.parse(await fs.readFile(path.join(game, '.vlauncher/installed.json'), 'utf8')).releaseId,
    ).toBe('r1');
  });
  it('rolls back newly added files on cancellation', async () => {
    const abort = new AbortController();
    await expect(
      commitInstall(game, stage, 'r1', abort.signal, () => abort.abort()),
    ).rejects.toThrow();
    expect(await exists(path.join(game, 'BepInEx/core/BepInEx.dll'))).toBe(false);
    expect(await exists(path.join(game, 'winhttp.dll'))).toBe(false);
  });
  it('refuses an incomplete bootstrap', async () => {
    await fs.unlink(path.join(stage, 'winhttp.dll'));
    await expect(commitInstall(game, stage, 'r1')).rejects.toThrow('Incomplete');
  });
  it('refuses archives targeting arbitrary game files', async () => {
    await put(stage, 'valheim.exe', 'malicious');
    await expect(commitInstall(game, stage, 'r1')).rejects.toThrow('managed');
    expect(await fs.readFile(path.join(game, 'valheim.exe'), 'utf8')).toBe('valheim.exe');
  });
  it('refuses a foreign .vlauncher directory without touching it', async () => {
    await put(game, '.vlauncher/owner', 'other');
    await expect(commitInstall(game, stage, 'r1')).rejects.toThrow('Unrecognized');
  });
  it('does not follow existing BepInEx junctions', async () => {
    const external = path.join(dir, 'foreign');
    await put(external, 'core/BepInEx.dll', 'foreign');
    await fs.symlink(external, path.join(game, 'BepInEx'), 'junction');
    await expect(commitInstall(game, stage, 'r1')).rejects.toThrow('symbolic link');
    expect(await fs.readFile(path.join(external, 'core/BepInEx.dll'), 'utf8')).toBe('foreign');
  });
  it('does not touch unrelated root junctions', async () => {
    const external = path.join(dir, 'other');
    await fs.mkdir(external);
    await fs.symlink(external, path.join(game, 'unrelated'), 'junction');
    await commitInstall(game, stage, 'r1');
    expect((await fs.lstat(path.join(game, 'unrelated'))).isSymbolicLink()).toBe(true);
  });
  it('rejects file/directory conflicts', async () => {
    await fs.mkdir(path.join(game, 'winhttp.dll'));
    await expect(commitInstall(game, stage, 'r1')).rejects.toThrow('directory');
  });
  it('rejects symlinks in a prepared stage', async () => {
    await fs.symlink(game, path.join(stage, 'linked'), 'junction');
    await expect(listFiles(stage)).rejects.toThrow('Links');
  });
  it.each(['pending', 'committed'])('recovers %s journals after a restart', async (phase) => {
    await recover(game);
    await put(game, 'winhttp.dll', 'interrupted');
    await put(game, '.vlauncher/backup-abcd/winhttp.dll', 'previous');
    await put(
      game,
      '.vlauncher/journal.json',
      JSON.stringify({
        schemaVersion: 1,
        phase,
        backup: 'backup-abcd',
        entries: [{ name: 'winhttp.dll', existed: true }],
      }),
    );
    await recover(game);
    expect(await fs.readFile(path.join(game, 'winhttp.dll'), 'utf8')).toBe(
      phase === 'pending' ? 'previous' : 'interrupted',
    );
    expect(await exists(path.join(game, '.vlauncher/journal.json'))).toBe(false);
    await recover(game);
  });
  it('retains the journal if a required backup is missing', async () => {
    await recover(game);
    await fs.mkdir(path.join(game, '.vlauncher/backup-abcd'));
    await put(
      game,
      '.vlauncher/journal.json',
      JSON.stringify({
        schemaVersion: 1,
        phase: 'pending',
        backup: 'backup-abcd',
        entries: [{ name: 'winhttp.dll', existed: true }],
      }),
    );
    await expect(recover(game)).rejects.toThrow('Missing');
    expect(await exists(path.join(game, '.vlauncher/journal.json'))).toBe(true);
  });
  it('rejects a forged recovery path', async () => {
    await recover(game);
    await put(
      game,
      '.vlauncher/journal.json',
      JSON.stringify({ schemaVersion: 1, phase: 'pending', backup: '../../foreign', entries: [] }),
    );
    await expect(recover(game)).rejects.toThrow('journal');
  });
});
describe('downloads and cache', () => {
  const signal = () => new AbortController().signal;
  it('downloads four archives and installs one pinned release', async () => {
    const r = release();
    const request = vi.fn(r.request);
    expect(
      (await installRelease(game, 'https://mods.example', cache, signal(), undefined, request))
        .releaseId,
    ).toBe('r1');
    expect(request).toHaveBeenCalledTimes(5);
    expect(await fs.readFile(path.join(game, 'BepInEx/plugins/mod.dll'), 'utf8')).toBe('mod-r1');
    const zips = async () => (await fs.readdir(cache)).filter((n) => n.endsWith('.zip'));
    expect(await zips()).toHaveLength(4);
    request.mockClear();
    await installRelease(game, 'https://mods.example', cache, signal(), undefined, request);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('reports a rising install percent that ends at 100', async () => {
    const r = release();
    const seen: [string, number][] = [];
    await installRelease(
      game,
      'https://mods.example',
      cache,
      signal(),
      (text, percent) => seen.push([text, percent]),
      r.request,
    );
    const percents = seen.map(([, p]) => p);
    expect(percents[0]).toBe(0);
    expect(percents.at(-1)).toBe(100);
    expect(percents.every((p, i) => i === 0 || p >= percents[i - 1])).toBe(true);
    expect(seen.some(([text]) => text === 'Скачивание plugins')).toBe(true);
    // A second install from the cache still runs from 0 to 100 without downloads.
    seen.length = 0;
    await installRelease(
      game,
      'https://mods.example',
      cache,
      signal(),
      (text, percent) => seen.push([text, percent]),
      r.request,
    );
    expect(seen.at(-1)?.[1]).toBe(100);
    expect(seen.some(([text]) => text.startsWith('Скачивание'))).toBe(false);
  });
  it('drops archives of older releases but keeps the last one of each server', async () => {
    const zips = async () => (await fs.readdir(cache)).filter((n) => n.endsWith('.zip')).sort();
    const base = 'https://mods.example';
    const r1 = release('r1');
    await installRelease(game, base, cache, signal(), undefined, r1.request, 'main');
    const test = release('t1');
    await installRelease(
      game,
      base,
      cache,
      signal(),
      undefined,
      test.request,
      '0123abcd-0000-4000-8000-00000000cafe',
    );
    const r2 = release('r2');
    await installRelease(game, base, cache, signal(), undefined, r2.request, 'main');
    const expected = [...r2.manifest.archives, ...test.manifest.archives]
      .map((a) => a.sha256 + '.zip')
      .sort();
    expect(await zips()).toEqual([...new Set(expected)].sort());
  });
  it('reads the server list and falls back to the main server on older panels', async () => {
    const list = {
      schemaVersion: 1,
      servers: [
        {
          id: 'main',
          name: 'Main',
          address: '10.0.0.5:2456',
          running: true,
          releaseId: 'r1',
          manifest: 'files/launcher-manifest.json',
        },
        {
          id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
          kind: 'test',
          name: 'Test',
          address: 'bad address',
          running: false,
          releaseId: null,
          manifest: 'files/servers/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee/launcher-manifest.json',
        },
      ],
    };
    const servers = await fetchServers('https://mods.example', signal(), (async () =>
      Response.json(list)) as typeof fetch);
    expect(servers.map((s) => [s.id, s.kind, s.address, s.running, s.releaseId])).toEqual([
      ['main', 'main', '10.0.0.5:2456', true, 'r1'],
      ['aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', 'test', null, false, null],
    ]);
    const old = await fetchServers(
      'https://mods.example',
      signal(),
      (async () => new Response(null, { status: 404 })) as typeof fetch,
    );
    expect(old.map((s) => s.id)).toEqual(['main']);
    for (const broken of [
      { ...list, schemaVersion: 2 },
      { schemaVersion: 1, servers: [list.servers[1]] },
      {
        schemaVersion: 1,
        servers: [list.servers[0], { ...list.servers[1], manifest: 'https://evil.example/m.json' }],
      },
      {
        schemaVersion: 1,
        servers: [
          list.servers[0],
          { ...list.servers[1], id: '../x', manifest: 'files/servers/../x/launcher-manifest.json' },
        ],
      },
    ])
      expect(() => validateServers(broken)).toThrow();
  });
  it('keeps only the main server for the player build', () => {
    const test = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const servers = validateServers({
      schemaVersion: 1,
      servers: [
        { id: test, manifest: `files/servers/${test}/launcher-manifest.json` },
        { id: 'main', manifest: 'files/launcher-manifest.json' },
      ],
    });
    expect(visibleServers(servers, 'dev')).toEqual(servers);
    expect(visibleServers(servers, undefined)).toEqual(servers);
    expect(visibleServers(servers, 'prod').map((s) => s.id)).toEqual(['main']);
  });
  it('trusts signed files only when the build carries a key', async () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
    const key = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
    // The same as kuberheim's signedJson: signature over JSON.stringify of the rest.
    const signed = (value: object, by = privateKey) =>
      JSON.stringify({
        ...value,
        signature: crypto.sign(null, Buffer.from(JSON.stringify(value)), by).toString('base64'),
      });
    const list = {
      schemaVersion: 1,
      updatedAt: '2026-10-06T12:00:00.000Z',
      servers: [
        { id: 'main', manifest: 'files/launcher-manifest.json', state: 'ready', running: true },
      ],
    };
    expect(readSigned(signed(list), key)).toEqual(list);
    expect(readSigned(JSON.stringify(list))).toEqual(list);
    expect(() => readSigned(JSON.stringify(list), key)).toThrow(/Подпись/);
    expect(() => readSigned('null', key)).toThrow(/Unsigned/);
    const tampered = signed(list).replace('"ready"', '"stopped"');
    expect(() => readSigned(tampered, key)).toThrow(/Подпись/);
    const other = crypto.generateKeyPairSync('ed25519').privateKey;
    expect(() => readSigned(signed(list, other), key)).toThrow(/Подпись/);
    // Served by the bucket a minute after the panel wrote it: as is. Ten minutes later: unknown.
    const serve = (date: string) =>
      (async () => new Response(signed(list), { headers: { date } })) as unknown as typeof fetch;
    const fresh = await fetchServers(
      'https://mods.example',
      signal(),
      serve('Tue, 06 Oct 2026 12:01:00 GMT'),
      key,
    );
    expect([fresh[0].state, fresh[0].running]).toEqual(['ready', true]);
    const late = new Date(Date.parse(list.updatedAt) + staleServerListMs + 1000).toUTCString();
    const stale = await fetchServers('https://mods.example', signal(), serve(late), key);
    expect([stale[0].state, stale[0].running]).toEqual(['unavailable', null]);
    await expect(
      fetchServers(
        'https://mods.example',
        signal(),
        (async () => Response.json(list)) as unknown as typeof fetch,
        key,
      ),
    ).rejects.toThrow(/Подпись/);
    const r = release();
    const unsigned = r.request as typeof fetch;
    await expect(
      fetchManifest('https://mods.example', signal(), unsigned, 'main', key),
    ).rejects.toThrow(/Подпись/);
    const signedManifest = (async (url: string | URL | Request) =>
      String(url).endsWith('/files/launcher-manifest.json')
        ? new Response(signed(r.manifest))
        : unsigned(url)) as typeof fetch;
    expect(
      (await fetchManifest('https://mods.example', signal(), signedManifest, 'main', key))
        .releaseId,
    ).toBe(r.manifest.releaseId);
  });
  it('installs the modpack of a test server from its own manifest', async () => {
    const r = release();
    const request = vi.fn(async (url: string | URL | Request) =>
      String(url).endsWith(
        '/files/servers/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee/launcher-manifest.json',
      )
        ? r.request('https://mods.example/files/launcher-manifest.json')
        : String(url).endsWith('launcher-manifest.json')
          ? new Response(null, { status: 500 })
          : r.request(url),
    );
    const installed = await installRelease(
      game,
      'https://mods.example',
      cache,
      signal(),
      undefined,
      request as typeof fetch,
      'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    );
    expect(installed.releaseId).toBe('r1');
    await expect(
      fetchManifest('https://mods.example', signal(), request as typeof fetch, '../main'),
    ).rejects.toThrow();
  });
  it('reads the published revision without installing', async () => {
    const r = release();
    const request = vi.fn(async (url: string | URL | Request) => {
      const response = await r.request(url);
      if (!String(url).endsWith('launcher-manifest.json')) return response;
      return Response.json({
        ...(await response.json()),
        title: 'Starblood r8',
        activatedAt: '2026-09-16T10:00:00.000Z',
        createdAt: { injected: true },
      });
    });
    const m = await fetchManifest('https://mods.example', signal(), request as typeof fetch);
    expect(releaseInfo(m)).toEqual({
      releaseId: 'r1',
      title: 'Starblood r8',
      gameVersion: null,
      createdAt: null,
      activatedAt: '2026-09-16T10:00:00.000Z',
    });
    expect(request).toHaveBeenCalledTimes(1);
    expect(await exists(path.join(game, '.vlauncher'))).toBe(false);
  });
  it('redownloads a corrupt cached archive', async () => {
    const r = release();
    await put(cache, r.manifest.archives[0].sha256 + '.zip', 'corrupt');
    await installRelease(game, 'https://mods.example', cache, signal(), undefined, r.request);
    expect(await hashFile(path.join(cache, r.manifest.archives[0].sha256 + '.zip'))).toBe(
      r.manifest.archives[0].sha256,
    );
  });
  it.each(['corrupt', 'short', 'long', 'http-error'])(
    'keeps the old installation on %s downloads',
    async (fault) => {
      await put(game, 'winhttp.dll', 'old');
      const r = release();
      const request: typeof fetch = async (url, options) => {
        if (String(url).endsWith('plugins.zip')) {
          if (fault === 'http-error') return new Response(null, { status: 503 });
          let b: Uint8Array = new Uint8Array(r.data.plugins);
          if (fault === 'corrupt') b[0] ^= 1;
          if (fault === 'short') b = b.subarray(1);
          if (fault === 'long') b = Buffer.concat([b, b]);
          return new Response(new Uint8Array(b));
        }
        return r.request(url);
      };
      await expect(
        installRelease(game, 'https://mods.example', cache, signal(), undefined, request),
      ).rejects.toThrow();
      expect(await fs.readFile(path.join(game, 'winhttp.dll'), 'utf8')).toBe('old');
      expect((await fs.readdir(cache)).some((n) => n.startsWith('install-'))).toBe(false);
    },
  );
  it('refuses missing manifests instead of installing mutable legacy ZIPs', async () => {
    await expect(
      installRelease(
        game,
        'https://mods.example',
        cache,
        signal(),
        undefined,
        async () => new Response(null, { status: 404 }),
      ),
    ).rejects.toThrow('404');
  });
  it('requires HTTPS outside loopback', async () => {
    const request = vi.fn();
    await expect(
      installRelease(game, 'http://mods.example', cache, signal(), undefined, request),
    ).rejects.toThrow('HTTPS');
    expect(request).not.toHaveBeenCalled();
  });
  it('allows plain HTTP for private LAN addresses', async () => {
    const request = vi.fn(async () => new Response(null, { status: 404 }));
    await expect(
      installRelease(game, 'http://192.168.50.181:3000', cache, signal(), undefined, request),
    ).rejects.toThrow('404');
    expect(request).toHaveBeenCalled();
  });
  it('cancels before starting network requests', async () => {
    const request = vi.fn();
    await expect(
      installRelease(game, 'https://mods.example', cache, AbortSignal.abort(), undefined, request),
    ).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
  it('handles a real local HTTP server and rejects redirects', async () => {
    const r = release();
    let redirect = false;
    const server = createServer((req, res) => {
      if (req.url?.endsWith('launcher-manifest.json')) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(r.manifest));
      } else if (redirect) {
        res.writeHead(302, { Location: '/wrong.zip' });
        res.end();
      } else {
        const a = r.manifest.archives.find((a) => req.url?.endsWith(a.url));
        if (a) res.end(r.data[a.name]);
        else {
          res.statusCode = 404;
          res.end();
        }
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const address = server.address() as { port: number };
      const base = 'http://127.0.0.1:' + address.port;
      await installRelease(game, base, cache, signal());
      redirect = true;
      await expect(
        installRelease(game, base, path.join(dir, 'new-cache'), signal()),
      ).rejects.toThrow();
      expect(await fs.readFile(path.join(game, 'winhttp.dll'), 'utf8')).toBe('loader-r1');
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      );
    }
  });
});

// A release as the kuberheim bucket publishes it: archives, files.json and files/objects/<sha256>.
function bucketRelease(id: string, plugins: Record<string, string>) {
  const r = release(id);
  const content: Record<string, string> = {
    'BepInEx/core/BepInEx.dll': 'core-' + id,
    'winhttp.dll': 'loader-' + id,
    'BepInEx/patchers/patch.dll': 'patch-' + id,
    'BepInEx/config/mod.cfg': 'config-' + id,
    ...Object.fromEntries(Object.entries(plugins).map(([n, v]) => ['BepInEx/plugins/' + n, v])),
  };
  const sha = (v: string | Buffer) => crypto.createHash('sha256').update(v).digest('hex');
  // The archives carry the same files, so a fallback installs the same release.
  r.data.plugins = zipBytes(plugins);
  r.manifest.archives = r.manifest.archives.map((a) =>
    a.name === 'plugins' ? { ...a, size: r.data.plugins.length, sha256: sha(r.data.plugins) } : a,
  );
  const files = Object.entries(content)
    .map(([p, v]) => ({ path: p, sha256: sha(v), size: Buffer.byteLength(v) }))
    .sort((a, b) => (a.path < b.path ? -1 : 1));
  const list = JSON.stringify({ schemaVersion: 1, releaseId: id, files });
  r.manifest.files = {
    url: `files/releases/${id}/files.json`,
    sha256: sha(list),
    size: Buffer.byteLength(list),
  };
  const objects = new Map(Object.values(content).map((v) => [sha(v), v]));
  const requested: string[] = [];
  const missing = new Set<string>();
  const request = (async (input: string | URL | Request) => {
    const url = String(input);
    requested.push(url.replace('https://mods.example/', ''));
    if (url.endsWith('/launcher-manifest.json')) return Response.json(r.manifest);
    if (url.endsWith('/files.json')) return new Response(list);
    const object = /files\/objects\/([a-f0-9]{64})$/.exec(url)?.[1];
    if (object)
      return objects.has(object) && !missing.has(object)
        ? new Response(objects.get(object))
        : new Response(null, { status: 404 });
    const entry = r.manifest.archives.find((a) => url.endsWith(a.url));
    return entry
      ? new Response(new Uint8Array(r.data[entry.name]))
      : new Response(null, { status: 404 });
  }) as typeof fetch;
  return { ...r, content, files, list, request, requested, missing, sha };
}

describe('per-file install from the bucket', () => {
  const signal = () => new AbortController().signal;
  const base = 'https://mods.example';
  const installed = async (rel: string) => fs.readFile(path.join(game, rel), 'utf8');
  const objectsOf = (requested: string[]) =>
    requested.filter((u) => u.startsWith('files/objects/'));
  it('installs a fresh game from objects, never touching the archives', async () => {
    const r = bucketRelease('r1', { 'Mod/mod.dll': 'mod-r1', 'Shared/big.dll': 'shared' });
    const info = await installRelease(game, base, cache, signal(), undefined, r.request, 'main');
    expect(info.releaseId).toBe('r1');
    for (const [rel, value] of Object.entries(r.content)) expect(await installed(rel)).toBe(value);
    expect(r.requested.filter((u) => u.endsWith('.zip'))).toEqual([]);
    expect(objectsOf(r.requested)).toHaveLength(Object.keys(r.content).length);
    // Downloaded objects are not kept once installed; the hashes of what is installed are.
    expect(await exists(path.join(cache, 'objects'))).toBe(false);
    const hashes = JSON.parse(await fs.readFile(path.join(cache, 'file-hashes.json'), 'utf8'));
    expect(Object.keys(hashes)).toHaveLength(Object.keys(r.content).length);
  });
  it('updates by downloading only the changed files and drops what the release no longer has', async () => {
    const r1 = bucketRelease('r1', {
      'Mod/mod.dll': 'mod-r1',
      'Shared/big.dll': 'shared',
      'Old/old.dll': 'old',
    });
    await installRelease(game, base, cache, signal(), undefined, r1.request, 'main');
    const big = path.join(game, 'BepInEx/plugins/Shared/big.dll');
    const before = (await fs.stat(big)).mtimeMs;
    // r2 keeps big.dll, changes mod.dll and the release-specific core files, drops old.dll.
    const r2 = bucketRelease('r2', { 'Mod/mod.dll': 'mod-r2', 'Shared/big.dll': 'shared' });
    const progress: number[] = [];
    await installRelease(
      game,
      base,
      cache,
      signal(),
      (_t, p) => progress.push(p),
      r2.request,
      'main',
    );
    const objects = objectsOf(r2.requested);
    expect(objects).toHaveLength(5); // mod.dll, core, loader, patch, config: not big.dll
    expect(objects).not.toContain('files/objects/' + r2.sha('shared'));
    expect(await installed('BepInEx/plugins/Mod/mod.dll')).toBe('mod-r2');
    expect((await fs.stat(big)).mtimeMs).toBe(before);
    expect(await exists(path.join(game, 'BepInEx/plugins/Old/old.dll'))).toBe(false);
    expect(progress.at(-1)).toBe(100);
    // Nothing changed: no object is fetched again.
    r2.requested.length = 0;
    await installRelease(game, base, cache, signal(), undefined, r2.request, 'main');
    expect(objectsOf(r2.requested)).toEqual([]);
  });
  it('replaces a file the player changed, even with the same size', async () => {
    const r = bucketRelease('r1', { 'Mod/mod.dll': 'mod-r1' });
    await installRelease(game, base, cache, signal(), undefined, r.request, 'main');
    const mod = path.join(game, 'BepInEx/plugins/Mod/mod.dll');
    await fs.writeFile(mod, 'MOD-R1');
    await fs.utimes(mod, new Date(), new Date(Date.now() + 5000));
    await installRelease(game, base, cache, signal(), undefined, r.request, 'main');
    expect(await installed('BepInEx/plugins/Mod/mod.dll')).toBe('mod-r1');
  });
  it('falls back to the archives when an object is missing, and says so', async () => {
    const r = bucketRelease('r1', { 'Mod/mod.dll': 'mod-r1' });
    r.missing.add(r.sha('mod-r1'));
    const log = vi.fn();
    const info = await installRelease(
      game,
      base,
      cache,
      signal(),
      undefined,
      r.request,
      'main',
      undefined,
      log,
    );
    expect(info.releaseId).toBe('r1');
    expect(await installed('BepInEx/plugins/Mod/mod.dll')).toBe('mod-r1');
    expect(r.requested.filter((u) => u.endsWith('.zip'))).toHaveLength(4);
    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(
        /per-file install of r1 failed, using archives: Download failed: HTTP 404/,
      ),
    );
  });
  it('rejects a file list that does not match the signed manifest or leaves the managed folders', async () => {
    const r = bucketRelease('r1', { 'Mod/mod.dll': 'mod-r1' });
    const log = vi.fn();
    const tampered = (async (input: string | URL | Request) =>
      String(input).endsWith('/files.json')
        ? new Response(r.list.replace('mod.dll', 'mad.dll'))
        : r.request(input)) as typeof fetch;
    await installRelease(game, base, cache, signal(), undefined, tampered, 'main', undefined, log);
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/File list checksum or size mismatch/));
    const good = { path: 'BepInEx/plugins/a.dll', sha256: 'a'.repeat(64), size: 1 };
    const list = (files: object[], releaseId = 'r1') => ({ schemaVersion: 1, releaseId, files });
    expect(validateFileList(list([good]), 'r1')).toEqual([good]);
    for (const bad of [
      list([good], 'r2'),
      list([]),
      list([{ ...good, path: '../valheim.exe' }]),
      list([{ ...good, path: 'valheim_Data/Managed/assembly_valheim.dll' }]),
      list([good, { ...good, path: 'BepInEx/plugins/A.dll' }]),
      list([{ ...good, sha256: 'x' }]),
      list([{ ...good, size: -1 }]),
    ])
      expect(() => validateFileList(bad, 'r1')).toThrow();
    const m = r.manifest;
    const files = m.files!;
    for (const broken of [
      { ...files, url: 'files/releases/r2/files.json' },
      { ...files, url: 'https://evil.example/files/releases/r1/files.json' },
      { ...files, size: 0 },
    ])
      expect(() => validateManifest({ ...m, files: broken }, base + '/')).toThrow(/file list/);
  });
  it('checks what it downloads and leaves no partial file behind', async () => {
    const file = path.join(cache, 'x.bin');
    await fs.mkdir(cache, { recursive: true });
    const serve = (body: string) => (async () => new Response(body)) as unknown as typeof fetch;
    const sha = crypto.createHash('sha256').update('abc').digest('hex');
    const x = 'https://mods.example/x';
    await downloadTo(x, file, { size: 3, sha256: sha }, signal(), serve('abc'));
    expect(await fs.readFile(file, 'utf8')).toBe('abc');
    await expect(
      downloadTo(x, file + '2', { size: 3, sha256: sha }, signal(), serve('abd')),
    ).rejects.toThrow(/checksum/);
    await expect(
      downloadTo(x, file + '3', { size: 3, sha256: sha }, signal(), serve('abcd')),
    ).rejects.toThrow(/exceeds/);
    expect((await fs.readdir(cache)).sort()).toEqual(['x.bin']);
  });
});
