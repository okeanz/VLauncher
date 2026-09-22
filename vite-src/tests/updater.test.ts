import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';
import AdmZip from 'adm-zip';
import {
  safeRelative,
  validateManifest,
  extractSafe,
  commitInstall,
  installRelease,
  fetchManifest,
  fetchServers,
  validateServers,
  releaseInfo,
  recover,
  exists,
  hashFile,
  listFiles,
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
