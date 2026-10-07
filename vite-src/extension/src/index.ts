import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { setupWs } from './websocket/setup-ws.js';
import { acquireLock } from './types/pidlock-promise.js';
import { shutdown, setLockRelease } from './on-exit.js';
import { dataDirectory } from './message-handler.js';
import { applyUpdate } from './self-update.js';
import { appendLog } from './utils/file-log.js';
async function start() {
  await fsp.mkdir(dataDirectory, { recursive: true });
  setLockRelease(await acquireLock(path.join(dataDirectory, 'instance.lock')));
  const input = JSON.parse(fs.readFileSync(process.stdin.fd, 'utf8'));
  if (
    !Number.isInteger(Number(input.nlPort)) ||
    Number(input.nlPort) < 1 ||
    Number(input.nlPort) > 65535 ||
    ![input.nlToken, input.nlConnectToken, input.nlExtensionId].every(
      (v) => typeof v === 'string' && v.length > 0,
    )
  )
    throw new Error('Invalid extension connection parameters');
  setupWs({
    NL_PORT: input.nlPort,
    NL_TOKEN: input.nlToken,
    NL_CTOKEN: input.nlConnectToken,
    NL_EXTID: input.nlExtensionId,
  });
}
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const)
  process.on(signal, () => {
    void shutdown();
  });
process.on('uncaughtException', (error) => {
  console.error(error.message);
  void shutdown(1);
});
process.on('unhandledRejection', (error) => {
  console.error(error instanceof Error ? error.message : 'Unhandled rejection');
  void shutdown(1);
});
// extension.exe --apply-update <new launcher folder> <launcher folder> <pids...>: the new build replacing the old
// one after it exits (self-update.ts). Neutralino never starts the extension with arguments.
const apply = process.argv.indexOf('--apply-update');
if (apply >= 0) {
  const [from, to, ...pids] = process.argv.slice(apply + 1);
  void applyUpdate(
    from,
    to,
    pids.map(Number).filter(Number.isInteger),
    (text) => void appendLog(text),
  )
    .catch((error) => appendLog(`launcher update crashed: ${(error as Error).message}`))
    .finally(() => setTimeout(() => process.exit(0), 500));
} else
  start().catch((error) => {
    console.error(error.message);
    void shutdown(1);
  });
