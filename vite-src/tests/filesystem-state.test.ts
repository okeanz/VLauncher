import { beforeEach, afterEach, it, expect, describe } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { acquireLock } from '../extension/src/types/pidlock-promise';
import { setOptimization, getOptimization } from '../extension/src/utils/boot-config';
import { exists } from '../extension/src/updater';
import { temporary, removeTemporary, put, release } from './fixtures';
import { publishRelease } from '../../scripts/publish-release.mjs';
let dir: string;
beforeEach(async () => {
  dir = await temporary();
});
afterEach(async () => {
  await removeTemporary(dir);
});
describe('instance lock', () => {
  it('releases exactly once and tolerates repeated cleanup', async () => {
    const file = path.join(dir, 'lock');
    const release = await acquireLock(file);
    expect(await exists(file)).toBe(true);
    await release();
    await release();
    expect(await exists(file)).toBe(false);
  });
  it('refuses a live owner', async () => {
    const file = path.join(dir, 'lock');
    const release = await acquireLock(file);
    await expect(acquireLock(file, () => true)).rejects.toThrow('запущен');
    await release();
  });
  it('recovers a stale lock without killing the old process', async () => {
    const file = await put(dir, 'lock', JSON.stringify({ pid: 12345, token: 'old' }));
    const release = await acquireLock(file, () => false);
    expect(JSON.parse(await fs.readFile(file, 'utf8')).pid).toBe(process.pid);
    await release();
  });
  it.each(['invalid JSON', '{}', '{"pid":0,"token":"x"}'])(
    'refuses malformed lock %s',
    async (content) => {
      const file = await put(dir, 'lock', content);
      await expect(acquireLock(file, () => false)).rejects.toThrow();
      expect(await fs.readFile(file, 'utf8')).toBe(content);
    },
  );
  it('does not unlink a new owner lock during cleanup', async () => {
    const file = path.join(dir, 'lock');
    const release = await acquireLock(file);
    await fs.writeFile(file, JSON.stringify({ pid: 1, token: 'new-owner' }));
    await release();
    expect(await exists(file)).toBe(true);
  });
});
describe('boot configuration', () => {
  it('reports persisted optimization state after restarting the launcher', async () => {
    expect(await getOptimization(dir)).toBe(false);
    await put(dir, 'valheim_Data/boot.config', 'original');
    await setOptimization(dir, true);
    expect(await getOptimization(dir)).toBe(true);
    await setOptimization(dir, false);
    expect(await getOptimization(dir)).toBe(false);
  });
  it('restores original values, comments and CRLF byte for byte', async () => {
    const original = '# user settings\r\ngfx-enable-gfx-jobs=0\r\ncustom=value\r\n';
    const file = await put(dir, 'valheim_Data/boot.config', original);
    await setOptimization(dir, true);
    expect(await fs.readFile(file, 'utf8')).toContain('gfx-enable-gfx-jobs=1');
    await setOptimization(dir, false);
    expect(await fs.readFile(file, 'utf8')).toBe(original);
    expect(await exists(file + '.vlauncher-backup')).toBe(false);
  });
  it('is idempotent when enabling twice', async () => {
    const file = await put(dir, 'valheim_Data/boot.config', 'original=1\n');
    await setOptimization(dir, true);
    const content = await fs.readFile(file, 'utf8');
    await setOptimization(dir, true);
    expect(await fs.readFile(file, 'utf8')).toBe(content);
    await setOptimization(dir, false);
    expect(await fs.readFile(file, 'utf8')).toBe('original=1\n');
  });
  it('does not remove settings that it did not create', async () => {
    const file = await put(dir, 'valheim_Data/boot.config', 'gfx-enable-gfx-jobs=1\n');
    await setOptimization(dir, false);
    expect(await fs.readFile(file, 'utf8')).toBe('gfx-enable-gfx-jobs=1\n');
  });
  it('preserves external changes and the backup instead of overwriting them', async () => {
    const file = await put(dir, 'valheim_Data/boot.config', 'original');
    await setOptimization(dir, true);
    await fs.appendFile(file, 'external=1');
    await expect(setOptimization(dir, false)).rejects.toThrow('другой');
    await expect(setOptimization(dir, true)).rejects.toThrow('другой');
    expect(await fs.readFile(file, 'utf8')).toContain('external=1');
    expect(await fs.readFile(file + '.vlauncher-backup', 'utf8')).toBe('original');
  });
  it('adopts a file replaced by a game update and drops the stale backup', async () => {
    const updated = 'gfx-enable-gfx-jobs=1\nbuild-guid=new\n';
    const file = await put(dir, 'valheim_Data/boot.config', 'build-guid=old\n');
    await setOptimization(dir, true);
    await fs.writeFile(file, updated);
    expect(await getOptimization(dir)).toBe(false);
    await setOptimization(dir, true);
    expect(await getOptimization(dir)).toBe(true);
    expect(await fs.readFile(file + '.vlauncher-backup', 'utf8')).toBe(updated);
    await setOptimization(dir, false);
    expect(await fs.readFile(file, 'utf8')).toBe(updated);
  });
  it('drops a stale backup when disabling after a game update', async () => {
    const file = await put(dir, 'valheim_Data/boot.config', 'build-guid=old\n');
    await setOptimization(dir, true);
    await fs.writeFile(file, 'build-guid=new\n');
    await setOptimization(dir, false);
    expect(await fs.readFile(file, 'utf8')).toBe('build-guid=new\n');
    expect(await exists(file + '.vlauncher-backup')).toBe(false);
  });
  it('reports missing files instead of pretending success', async () => {
    await expect(setOptimization(dir, true)).rejects.toThrow();
  });
  it('refuses a valheim_Data junction', async () => {
    const target = path.join(dir, 'external');
    await put(target, 'boot.config', 'personal');
    await fs.symlink(target, path.join(dir, 'valheim_Data'), 'junction');
    await expect(setOptimization(dir, true)).rejects.toThrow('Ссылки');
    expect(await fs.readFile(path.join(target, 'boot.config'), 'utf8')).toBe('personal');
  });
});
describe('release publication', () => {
  async function input() {
    const r = release();
    for (const [name, bytes] of Object.entries(r.data)) {
      await fs.mkdir(path.join(dir, 'input'), { recursive: true });
      await fs.writeFile(path.join(dir, 'input', name + '.zip'), bytes);
    }
    return r;
  }
  it('publishes four immutable archives and matching checksums before the manifest', async () => {
    const r = await input();
    const result = await publishRelease(path.join(dir, 'input'), path.join(dir, 'served'), 'r1');
    expect(result).toEqual(r.manifest);
    expect(
      JSON.parse(await fs.readFile(path.join(dir, 'served/launcher-manifest.json'), 'utf8')),
    ).toEqual(result);
    for (const name of Object.keys(r.data))
      expect(await fs.readFile(path.join(dir, 'served/releases/r1', name + '.zip'))).toEqual(
        r.data[name],
      );
  });
  it('refuses to overwrite a published version', async () => {
    await input();
    const source = path.join(dir, 'input'),
      served = path.join(dir, 'served');
    await publishRelease(source, served, 'r1');
    const before = await fs.readFile(path.join(served, 'launcher-manifest.json'), 'utf8');
    await put(source, 'plugins.zip', 'different');
    await expect(publishRelease(source, served, 'r1')).rejects.toThrow();
    expect(await fs.readFile(path.join(served, 'launcher-manifest.json'), 'utf8')).toBe(before);
  });
  it('keeps the previous manifest when an input archive is missing', async () => {
    await input();
    const source = path.join(dir, 'input'),
      served = path.join(dir, 'served');
    await publishRelease(source, served, 'r1');
    await fs.unlink(path.join(source, 'plugins.zip'));
    await expect(publishRelease(source, served, 'r2')).rejects.toThrow();
    expect(
      JSON.parse(await fs.readFile(path.join(served, 'launcher-manifest.json'), 'utf8')).releaseId,
    ).toBe('r1');
    expect(await exists(path.join(served, 'releases/r2'))).toBe(false);
  });
  it('rejects traversal release identifiers', async () => {
    await expect(publishRelease(dir, dir, '../other')).rejects.toThrow('Invalid');
  });
});
