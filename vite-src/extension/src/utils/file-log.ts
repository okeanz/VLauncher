import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// %LOCALAPPDATA%\VLauncher\launcher.log: what a player sends when the launcher cannot reach the update source
// or an install fails. Only public data goes in (URLs of the bucket, error codes), never tokens.
export const logFile = () =>
  path.join(process.env.LOCALAPPDATA || os.homedir(), 'VLauncher', 'launcher.log');
const maxBytes = 512 * 1024;

/** Message of an error plus its cause: Node's fetch says only "fetch failed" and keeps the reason in cause. */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = (error as { cause?: { code?: string; message?: string } }).cause;
  const reason = cause ? [cause.code, cause.message].filter(Boolean).join(' ') : '';
  return `${error.name === 'Error' ? '' : error.name + ': '}${error.message}${reason ? ` (${reason})` : ''}`;
}

/** Appends one line; the file is cut to a fresh one past 512 KB. Never throws: logging must not break the launcher. */
export async function appendLog(text: string, file = logFile()) {
  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const size = await fs.stat(file).then(
      (s) => s.size,
      () => 0,
    );
    if (size > maxBytes) await fs.rename(file, file + '.1').catch(() => {});
    await fs.appendFile(file, `${new Date().toISOString()} ${text}\n`);
  } catch {
    // Nowhere left to report it.
  }
}
