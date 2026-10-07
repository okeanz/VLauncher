import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import AdmZip from 'adm-zip';
import {
  applyUpdate,
  launcherFiles,
  launcherFolder,
  prepareLauncherUpdate,
  validateLauncherInfo,
} from '../extension/src/self-update';
import { temporary, removeTemporary, put } from './fixtures';

let dir: string;
beforeEach(async () => {
  dir = await temporary();
});
afterEach(async () => {
  await removeTemporary(dir);
});

const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
const key = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
const signed = (value: object) =>
  JSON.stringify({
    ...value,
    signature: crypto.sign(null, Buffer.from(JSON.stringify(value)), privateKey).toString('base64'),
  });
const sha = (b: Buffer) => crypto.createHash('sha256').update(b).digest('hex');
function published(version: string, files = launcherFiles) {
  const zip = new AdmZip();
  for (const f of files) zip.addFile('VLauncher/' + f, Buffer.from(`${f} ${version}`));
  const bytes = zip.toBuffer();
  const info = {
    schemaVersion: 1,
    version,
    url: `files/launcher/VLauncher-${version}.zip`,
    sha256: sha(bytes),
    size: bytes.length,
  };
  const requested: string[] = [];
  const request = (async (input: string | URL | Request) => {
    const url = String(input);
    requested.push(url);
    if (url.endsWith('/launcher.json')) return new Response(signed(info));
    if (url.endsWith(info.url)) return new Response(new Uint8Array(bytes));
    return new Response(null, { status: 404 });
  }) as typeof fetch;
  return { info, request, requested };
}
const base = 'https://mods.example/';
const signal = () => new AbortController().signal;

describe('launcher self-update', () => {
  it('accepts only a launcher.json that names its own versioned zip', () => {
    const good = {
      schemaVersion: 1,
      version: '20261008.120000-abc1234',
      url: 'files/launcher/VLauncher-20261008.120000-abc1234.zip',
      sha256: 'a'.repeat(64),
      size: 10,
    };
    expect(validateLauncherInfo(good).version).toBe(good.version);
    for (const bad of [
      { ...good, url: 'files/launcher/VLauncher-other.zip' },
      { ...good, version: '../x', url: 'files/launcher/VLauncher-../x.zip' },
      { ...good, sha256: 'x' },
      { ...good, size: 0 },
      { ...good, schemaVersion: 2 },
    ])
      expect(() => validateLauncherInfo(bad)).toThrow();
  });
  it('downloads, checks and unpacks a different version once', async () => {
    const p = published('v2');
    const directory = path.join(dir, 'launcher-update');
    const update = await prepareLauncherUpdate({
      base,
      publicKey: key,
      version: 'v1',
      directory,
      signal: signal(),
      request: p.request,
    });
    expect(update?.version).toBe('v2');
    for (const f of launcherFiles)
      expect(await fs.readFile(path.join(update!.folder, f), 'utf8')).toBe(`${f} v2`);
    // Ready on disk: the next check does not download it again.
    p.requested.length = 0;
    expect(
      await prepareLauncherUpdate({
        base,
        publicKey: key,
        version: 'v1',
        directory,
        signal: signal(),
        request: p.request,
      }),
    ).toEqual(update);
    expect(p.requested.filter((u) => u.endsWith('.zip'))).toEqual([]);
    // Once this launcher is that version, the download is cleaned up.
    expect(
      await prepareLauncherUpdate({
        base,
        publicKey: key,
        version: 'v2',
        directory,
        signal: signal(),
        request: p.request,
      }),
    ).toBeNull();
    await expect(fs.stat(directory)).rejects.toThrow();
  });
  it('does nothing in the admin build and trusts nothing unsigned or incomplete', async () => {
    const p = published('v2');
    const directory = path.join(dir, 'u');
    expect(
      await prepareLauncherUpdate({
        base,
        version: 'v1',
        directory,
        signal: signal(),
        request: p.request,
      }),
    ).toBeNull();
    expect(
      await prepareLauncherUpdate({
        base,
        publicKey: key,
        directory,
        signal: signal(),
        request: p.request,
      }),
    ).toBeNull();
    expect(p.requested).toEqual([]);
    const forged = (async () => new Response(JSON.stringify(p.info))) as unknown as typeof fetch;
    await expect(
      prepareLauncherUpdate({
        base,
        publicKey: key,
        version: 'v1',
        directory,
        signal: signal(),
        request: forged,
      }),
    ).rejects.toThrow(/Подпись/);
    const partial = published('v3', launcherFiles.slice(0, 2));
    await expect(
      prepareLauncherUpdate({
        base,
        publicKey: key,
        version: 'v1',
        directory,
        signal: signal(),
        request: partial.request,
      }),
    ).rejects.toThrow(/lacks/);
    const none = (async () => new Response(null, { status: 404 })) as unknown as typeof fetch;
    expect(
      await prepareLauncherUpdate({
        base,
        publicKey: key,
        version: 'v1',
        directory,
        signal: signal(),
        request: none,
      }),
    ).toBeNull();
  });
  it('swaps the files and starts the launcher; a failed swap keeps the old version whole', async () => {
    const app = path.join(dir, 'app'),
      next = path.join(dir, 'next');
    for (const f of launcherFiles) {
      await put(app, f, 'old ' + f);
      await put(next, f, 'new ' + f);
    }
    expect(await launcherFolder(path.join(app, 'extensions', 'extension.exe'))).toBe(app);
    await expect(launcherFolder(path.join(dir, 'x', 'extension.exe'))).rejects.toThrow(
      /не из своей папки/,
    );
    const start = vi.fn(),
      log = vi.fn();
    await applyUpdate(next, app, [], log, { start });
    for (const f of launcherFiles)
      expect(await fs.readFile(path.join(app, f), 'utf8')).toBe('new ' + f);
    expect((await fs.readdir(app)).sort()).toEqual([
      'VLauncher-win_x64.exe',
      'extensions',
      'resources.neu',
    ]);
    expect(start).toHaveBeenCalledWith(path.join(app, 'VLauncher-win_x64.exe'));
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/launcher updated/));
    // The new build lacks a file: nothing changes, and the launcher still starts.
    await fs.rm(path.join(next, 'resources.neu'));
    for (const f of launcherFiles)
      await put(next, f === 'resources.neu' ? 'other' : f, 'newer ' + f);
    await fs.rm(path.join(next, 'other'), { force: true });
    await applyUpdate(next, app, [], log, { start });
    for (const f of launcherFiles)
      expect(await fs.readFile(path.join(app, f), 'utf8')).toBe('new ' + f);
    expect(log).toHaveBeenLastCalledWith(expect.stringMatching(/failed, old version kept/));
    expect(start).toHaveBeenCalledTimes(2);
  });
  it('waits for the old launcher to exit before touching its files', async () => {
    const app = path.join(dir, 'app'),
      next = path.join(dir, 'next');
    for (const f of launcherFiles) {
      await put(app, f, 'old');
      await put(next, f, 'new');
    }
    const started = Date.now();
    // This test process is alive for the whole wait: the swap goes ahead only when the wait runs out.
    await applyUpdate(next, app, [process.pid], vi.fn(), { start: vi.fn(), waitMs: 600 });
    expect(Date.now() - started).toBeGreaterThanOrEqual(500);
  });
});
