import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { downloadTo, extractSafe, exists, readSigned } from './updater.js';

// Self-update of the player build. kuberheim publishes files/launcher/launcher.json, signed with the same ed25519
// key as the release manifest, naming the current launcher zip with its sha256. The running launcher downloads and
// unpacks a different version in the background; on the player's click the new extension.exe is started with
// --apply-update: it waits for the old launcher to exit, swaps the three files (rolling back on failure) and
// starts the launcher again. No script files, nothing elevated.

export const launcherFiles = ['VLauncher-win_x64.exe', 'resources.neu', 'extensions/extension.exe'];
export type LauncherInfo = { version: string; url: string; sha256: string; size: number };
const versionPattern = /^[0-9A-Za-z][0-9A-Za-z._-]{0,63}$/;

export function validateLauncherInfo(value: unknown): LauncherInfo {
  const v = value as Partial<LauncherInfo> & { schemaVersion?: number };
  if (
    v?.schemaVersion !== 1 ||
    typeof v.version !== 'string' ||
    !versionPattern.test(v.version) ||
    v.url !== `files/launcher/VLauncher-${v.version}.zip` ||
    typeof v.sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(v.sha256) ||
    !Number.isSafeInteger(v.size) ||
    (v.size as number) <= 0 ||
    (v.size as number) > 512 * 1024 ** 2
  )
    throw new Error('Invalid launcher update info');
  return { version: v.version, url: v.url, sha256: v.sha256, size: v.size as number };
}

/**
 * Prepares the published launcher when it differs from this one: returns the folder holding its files, ready to
 * apply, or null when this launcher is current (then old downloads are cleaned up). Only builds with a signing
 * key and a version (the player build) update themselves.
 */
export async function prepareLauncherUpdate(options: {
  base: string;
  publicKey?: string;
  version?: string;
  directory: string;
  signal: AbortSignal;
  request?: typeof fetch;
}): Promise<{ version: string; folder: string } | null> {
  const { base, publicKey, version, directory, signal, request = fetch } = options;
  if (!publicKey || !version) return null;
  const root = new URL(base.endsWith('/') ? base : base + '/');
  const response = await request(new URL('files/launcher/launcher.json', root).href, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
    redirect: 'error',
    cache: 'no-store',
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Launcher update info: HTTP ${response.status}`);
  const info = validateLauncherInfo(readSigned(await response.text(), publicKey));
  if (info.version === version) {
    await fs.rm(directory, { recursive: true, force: true });
    return null;
  }
  const target = path.join(directory, info.version);
  const folder = path.join(target, 'VLauncher');
  if (await exists(path.join(target, 'ready'))) return { version: info.version, folder };
  await fs.rm(directory, { recursive: true, force: true });
  await fs.mkdir(target, { recursive: true });
  const zip = path.join(directory, info.version + '.zip');
  await downloadTo(new URL(info.url, root).href, zip, info, signal, request, undefined, 'Launcher');
  await extractSafe(zip, target, signal);
  await fs.rm(zip, { force: true });
  for (const file of launcherFiles)
    if (!(await exists(path.join(folder, file)))) throw new Error('Launcher update lacks ' + file);
  await fs.writeFile(path.join(target, 'ready'), info.version);
  return { version: info.version, folder };
}

/** The launcher folder this extension runs from: <launcher>/extensions/extension.exe. */
export async function launcherFolder(execPath = process.execPath) {
  const folder = path.dirname(path.dirname(execPath));
  if (!(await exists(path.join(folder, 'VLauncher-win_x64.exe'))))
    throw new Error('Лаунчер запущен не из своей папки, обновить его нельзя');
  return folder;
}

/** Starts the new extension.exe in apply mode; it outlives this process. */
export function startApply(update: { folder: string }, target: string, pids: number[]) {
  const child = spawn(
    path.join(update.folder, 'extensions', 'extension.exe'),
    ['--apply-update', update.folder, target, ...pids.map(String)],
    { detached: true, stdio: 'ignore', windowsHide: true, cwd: update.folder },
  );
  child.unref();
}

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
/** Windows keeps a file locked a moment after its process exits, antivirus a little longer. */
async function retry<T>(work: () => Promise<T>, attempts = 20): Promise<T> {
  for (let n = 1; ; n++) {
    try {
      return await work();
    } catch (error) {
      if (n >= attempts) throw error;
      await pause(500);
    }
  }
}

/**
 * Apply mode: wait for the old launcher (pids) to exit, put the new files in place and start the launcher.
 * Each old file is kept as .old until all three are in; any failure restores them, so the folder always holds
 * one whole version. The launcher is started either way.
 */
export async function applyUpdate(
  from: string,
  to: string,
  pids: number[],
  log: (text: string) => void,
  options: { start?: (exe: string) => void; waitMs?: number } = {},
) {
  const { waitMs = 60000 } = options;
  const start =
    options.start ??
    ((exe: string) =>
      spawn(exe, [], { cwd: path.dirname(exe), detached: true, stdio: 'ignore' }).unref());
  for (const deadline = Date.now() + waitMs; pids.some(alive) && Date.now() < deadline; )
    await pause(250);
  const moved: string[] = [];
  try {
    for (const file of launcherFiles)
      await fs.copyFile(path.join(from, file), path.join(to, file + '.new'));
    for (const file of launcherFiles) {
      const target = path.join(to, file);
      await retry(() => fs.rename(target, target + '.old'));
      moved.push(file);
      await retry(() => fs.rename(target + '.new', target));
    }
    for (const file of launcherFiles)
      await fs.rm(path.join(to, file + '.old'), { force: true }).catch(() => {});
    log(`launcher updated from ${from}`);
  } catch (error) {
    for (const file of moved.reverse()) {
      const target = path.join(to, file);
      await fs.rm(target, { force: true }).catch(() => {});
      await fs.rename(target + '.old', target).catch(() => {});
    }
    for (const file of launcherFiles)
      await fs.rm(path.join(to, file + '.new'), { force: true }).catch(() => {});
    log(`launcher update failed, old version kept: ${(error as Error).message}`);
  }
  start(path.join(to, 'VLauncher-win_x64.exe'));
}
