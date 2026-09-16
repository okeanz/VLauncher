import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import AdmZip from 'adm-zip';

export const archiveNames = ['BepInEx', 'patchers', 'config', 'plugins'] as const;
export type Manifest = {
  schemaVersion: 1;
  releaseId: string;
  archives: { name: string; url: string; sha256: string; size: number }[];
};
const roots = new Set(['BepInEx', 'winhttp.dll', 'doorstop_config.ini', '.doorstop_version']);
const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
export function safeRelative(name: string): string {
  const normalized = name.replace(/\\/g, '/');
  const parts = normalized.replace(/\/$/, '').split('/');
  // Reject Windows control characters as well as reserved path syntax.
  if (
    !normalized ||
    parts.some(
      (p) =>
        !p ||
        p === '.' ||
        p === '..' ||
        /[<>:"|?*]/.test(p) ||
        [...p].some((character) => character.charCodeAt(0) < 32) ||
        /[ .]$/.test(p) ||
        reserved.test(p),
    )
  )
    throw new Error('Unsafe archive path: ' + name);
  return parts.join('/');
}
export function validateManifest(value: unknown, base: string): Manifest {
  const m = value as Manifest;
  if (
    !m ||
    m.schemaVersion !== 1 ||
    !/^[a-zA-Z0-9_-]{1,80}$/.test(m.releaseId) ||
    !Array.isArray(m.archives) ||
    m.archives.length !== 4
  )
    throw new Error('Invalid release manifest');
  const seen = new Set();
  for (const a of m.archives) {
    if (
      !archiveNames.includes(a.name as (typeof archiveNames)[number]) ||
      seen.has(a.name) ||
      !/^[a-f0-9]{64}$/.test(a.sha256) ||
      !Number.isSafeInteger(a.size) ||
      a.size <= 0 ||
      a.size > 2 * 1024 ** 3 ||
      typeof a.url !== 'string'
    )
      throw new Error('Invalid archive metadata');
    const url = new URL(a.url, base);
    if (
      url.origin !== new URL(base).origin ||
      url.username ||
      url.password ||
      url.hash ||
      url.search ||
      !url.pathname.startsWith(new URL(`files/releases/${m.releaseId}/`, base).pathname)
    )
      throw new Error('Archive URL must belong to this immutable release');
    seen.add(a.name);
  }
  return m;
}
export async function hashFile(file: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  for await (const data of createReadStream(file)) hash.update(data);
  return hash.digest('hex');
}
export async function exists(file: string) {
  try {
    await fs.lstat(file);
    return true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw e;
  }
}
export async function atomicJson(file: string, data: unknown) {
  const temp = file + '.tmp';
  const handle = await fs.open(temp, 'w');
  try {
    await handle.writeFile(JSON.stringify(data, null, 2));
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.rename(temp, file);
}
async function replaceFile(source: string, target: string) {
  const temp = path.join(path.dirname(target), '.vlauncher-' + crypto.randomUUID() + '.tmp');
  try {
    await fs.copyFile(source, temp);
    await fs.rename(temp, target);
  } finally {
    await fs.rm(temp, { force: true });
  }
}
export async function extractSafe(archive: string, dest: string, signal?: AbortSignal) {
  const zip = new AdmZip(archive);
  const seen = new Set<string>();
  const entries = zip.getEntries();
  let total = 0;
  if (entries.length > 100000) throw new Error('Too many archive entries');
  // Validate the complete directory before writing anything.
  for (const entry of entries) {
    const name = safeRelative(entry.entryName);
    const mode = (entry.attr >>> 16) & 0xf000;
    if (mode === 0xa000 || (mode && mode !== 0x8000 && mode !== 0x4000))
      throw new Error('Archive links and special files are forbidden');
    if (seen.has(name.toLowerCase())) throw new Error('Duplicate archive path');
    seen.add(name.toLowerCase());
    total += entry.header.size;
    if (entry.header.size > 512 * 1024 ** 2 || total > 8 * 1024 ** 3)
      throw new Error('Archive exceeds extraction limits');
  }
  for (const entry of entries) {
    signal?.throwIfAborted();
    const target = path.join(dest, safeRelative(entry.entryName));
    if (entry.isDirectory) {
      await fs.mkdir(target, { recursive: true });
      continue;
    }
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, entry.getData()); // adm-zip verifies the entry CRC
  }
}
export async function listFiles(dir: string, prefix = ''): Promise<string[]> {
  const result: string[] = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? prefix + '/' + e.name : e.name;
    if (e.isSymbolicLink()) throw new Error('Links are not allowed in managed directories: ' + rel);
    if (e.isDirectory()) result.push(...(await listFiles(path.join(dir, e.name), rel)));
    else if (e.isFile()) result.push(safeRelative(rel));
    else throw new Error('Unsupported file type');
  }
  return result;
}
type Installed = { schemaVersion: 1; releaseId: string; files: string[] };
type Journal = {
  schemaVersion: 1;
  phase: 'pending' | 'committed';
  backup: string;
  entries: { name: string; existed: boolean }[];
};
async function stateDirectory(game: string) {
  if (!(await fs.stat(path.join(game, 'valheim.exe'))).isFile())
    throw new Error('valheim.exe not found');
  const dir = path.join(game, '.vlauncher');
  if (await exists(dir)) {
    if (
      (await fs.lstat(dir)).isSymbolicLink() ||
      (await fs.readFile(path.join(dir, 'owner'), 'utf8')) !== 'VLauncher-v1'
    )
      throw new Error('Unrecognized .vlauncher directory');
  } else {
    await fs.mkdir(dir);
    await fs.writeFile(path.join(dir, 'owner'), 'VLauncher-v1', { flag: 'wx' });
  }
  return dir;
}
function managedName(name: string) {
  if (safeRelative(name) !== name || !roots.has(name.split('/')[0]))
    throw new Error('Invalid managed file: ' + name);
}
export async function recover(game: string) {
  const dir = await stateDirectory(game);
  const journalPath = path.join(dir, 'journal.json');
  if (!(await exists(journalPath))) return;
  const j: Journal = JSON.parse(await fs.readFile(journalPath, 'utf8'));
  if (
    j.schemaVersion !== 1 ||
    !/^backup-[a-f0-9-]+$/.test(j.backup) ||
    !Array.isArray(j.entries) ||
    !['pending', 'committed'].includes(j.phase)
  )
    throw new Error('Invalid recovery journal');
  const backup = path.join(dir, j.backup);
  if ((await fs.lstat(backup)).isSymbolicLink()) throw new Error('Unsafe backup directory');
  for (const e of j.entries) managedName(e.name);
  if (j.phase === 'pending') {
    for (const e of [...j.entries].reverse()) {
      const target = path.join(game, e.name);
      const saved = path.join(backup, e.name);
      await assertNoLinks(game, e.name);
      await assertNoLinks(backup, e.name);
      if (e.existed && !(await exists(saved)))
        throw new Error('Missing recovery backup: ' + e.name);
      if (e.existed) {
        await fs.mkdir(path.dirname(target), { recursive: true });
        await replaceFile(saved, target);
      } else if (!e.existed) await fs.rm(target, { force: true });
    }
    if (await exists(path.join(backup, 'installed.json')))
      await fs.copyFile(path.join(backup, 'installed.json'), path.join(dir, 'installed.json'));
    else await fs.rm(path.join(dir, 'installed.json'), { force: true });
  }
  await fs.unlink(journalPath);
}
async function assertNoLinks(base: string, relative: string) {
  let current = base;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    if ((await exists(current)) && (await fs.lstat(current)).isSymbolicLink())
      throw new Error('Existing symbolic link must be migrated manually: ' + current);
  }
}
export async function commitInstall(
  game: string,
  stage: string,
  releaseId: string,
  signal?: AbortSignal,
  beforeWrite?: (name: string) => void,
) {
  await recover(game);
  const dir = await stateDirectory(game);
  const installedPath = path.join(dir, 'installed.json');
  const previous: Installed = (await exists(installedPath))
    ? JSON.parse(await fs.readFile(installedPath, 'utf8'))
    : { schemaVersion: 1, releaseId: '', files: [] };
  if (previous.schemaVersion !== 1 || !Array.isArray(previous.files))
    throw new Error('Invalid installation record');
  const files = await listFiles(stage);
  if (!files.some((f) => f.startsWith('BepInEx/core/')) || !files.includes('winhttp.dll'))
    throw new Error('Incomplete Windows BepInEx package');
  const touched = [...new Set([...previous.files, ...files])];
  const entries: Journal['entries'] = [];
  for (const name of touched) {
    managedName(name);
    await assertNoLinks(game, name);
    const target = path.join(game, name);
    const found = await exists(target);
    if (found && !(await fs.stat(target)).isFile())
      throw new Error('File conflicts with directory: ' + name);
    if (
      found &&
      files.includes(name) &&
      (await hashFile(target)) === (await hashFile(path.join(stage, name)))
    )
      continue;
    if (!found && !files.includes(name)) continue;
    entries.push({ name, existed: found });
  }
  if (
    !entries.length &&
    previous.releaseId === releaseId &&
    previous.files.length === files.length &&
    previous.files.every((name) => files.includes(name))
  )
    return;
  const backupName = 'backup-' + crypto.randomUUID();
  const backup = path.join(dir, backupName);
  await fs.mkdir(backup);
  // Back up all affected files before recording a transaction or changing the game.
  for (const e of entries)
    if (e.existed) {
      const saved = path.join(backup, e.name);
      await fs.mkdir(path.dirname(saved), { recursive: true });
      await fs.copyFile(path.join(game, e.name), saved);
    }
  if (await exists(installedPath))
    await fs.copyFile(installedPath, path.join(backup, 'installed.json'));
  const journal: Journal = { schemaVersion: 1, phase: 'pending', backup: backupName, entries };
  await atomicJson(path.join(dir, 'journal.json'), journal);
  try {
    for (const { name } of entries) {
      signal?.throwIfAborted();
      beforeWrite?.(name);
      const target = path.join(game, name);
      if (files.includes(name)) {
        await fs.mkdir(path.dirname(target), { recursive: true });
        await replaceFile(path.join(stage, name), target);
      } else await fs.rm(target, { force: true });
    }
    await atomicJson(installedPath, { schemaVersion: 1, releaseId, files });
    await atomicJson(path.join(dir, 'journal.json'), { ...journal, phase: 'committed' });
  } catch (e) {
    await recover(game);
    throw e;
  }
  await recover(game);
}

/** HTTP is tolerated only for loopback and RFC 1918 private IPv4 addresses (home LAN). */
export function isTrustedHttpHost(hostname: string): boolean {
  if (['localhost', '127.0.0.1', '[::1]'].includes(hostname)) return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}
export async function installRelease(
  game: string,
  base: string,
  cache: string,
  signal: AbortSignal,
  progress: (text: string) => void = () => {},
  request: typeof fetch = fetch,
) {
  const baseUrl = new URL(base.endsWith('/') ? base : base + '/');
  if (
    !(
      baseUrl.protocol === 'https:' ||
      (baseUrl.protocol === 'http:' && isTrustedHttpHost(baseUrl.hostname))
    )
  )
    throw new Error(
      'File server requires HTTPS (HTTP is allowed only on localhost or private LAN addresses)',
    );
  async function get(url: string) {
    signal.throwIfAborted();
    const response = await request(url, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(120000)]),
      redirect: 'error',
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
    return response;
  }
  await recover(game);
  const response = await get(new URL('files/launcher-manifest.json', baseUrl).href);
  const manifest = validateManifest(await response.json(), baseUrl.href);
  await fs.mkdir(cache, { recursive: true });
  const work = await fs.mkdtemp(path.join(cache, 'install-'));
  const stage = path.join(work, 'stage');
  await fs.mkdir(stage);
  try {
    for (const name of archiveNames) {
      const a = manifest.archives.find((a) => a.name === name)!;
      const blob = path.join(cache, a.sha256 + '.zip');
      if (
        !(await exists(blob)) ||
        (await fs.stat(blob)).size !== a.size ||
        (await hashFile(blob)) !== a.sha256
      ) {
        progress('Скачивание ' + name);
        const r = await get(new URL(a.url, baseUrl).href);
        if (!r.body) throw new Error('Empty download');
        let bytes = 0;
        const counter = new Transform({
          transform(chunk, _encoding, done) {
            bytes += chunk.length;
            done(bytes > a.size ? new Error('Download exceeds declared size') : null, chunk);
          },
        });
        const partial = path.join(work, name + '.part');
        await pipeline(Readable.fromWeb(r.body as never), counter, createWriteStream(partial), {
          signal,
        });
        if (bytes !== a.size || (await hashFile(partial)) !== a.sha256)
          throw new Error('Archive checksum or size mismatch: ' + name);
        await fs.rename(partial, blob);
      }
      progress('Распаковка ' + name);
      await extractSafe(
        blob,
        name === 'BepInEx' ? stage : path.join(stage, 'BepInEx', name),
        signal,
      );
    }
    signal.throwIfAborted();
    progress('Установка проверенных файлов');
    await commitInstall(game, stage, manifest.releaseId, signal);
    return manifest.releaseId;
  } finally {
    await fs.rm(work, { recursive: true, force: true });
  }
}
