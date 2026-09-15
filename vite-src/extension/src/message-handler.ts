import type { MessageEvent } from 'ws';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Controller } from './controller.js';
import { installRelease } from './updater.js';
import { sendProgressEvent } from './ws-events/progress-events.js';
import { receivedPong } from './websocket/heartbeat.js';
import { shutdown } from './on-exit.js';
import { setOptimization, getOptimization } from './utils/boot-config.js';

export const dataDirectory = path.join(process.env.LOCALAPPDATA || os.homedir(), 'VLauncher');
let childRunning = false;
export async function gameRunning() {
  if (childRunning) return true;
  const { stdout } = await promisify(execFile)(
    'tasklist.exe',
    ['/FO', 'CSV', '/NH', '/FI', 'IMAGENAME eq valheim.exe'],
    { windowsHide: true },
  );
  return /^"valheim\.exe",/im.test(stdout);
}
export const controller = new Controller({
  running: gameRunning,
  notify: sendProgressEvent,
  install: async (game, signal) => {
    if (!path.isAbsolute(game)) throw new Error('Укажите абсолютный путь к игре');
    if (!(await fs.stat(path.join(game, 'valheim.exe'))).isFile())
      throw new Error('Valheim не найден');
    const base = process.env.VITE_API_URL;
    if (!base) throw new Error('Не настроен адрес сервера обновлений');
    const releaseId = await installRelease(
      game,
      base,
      path.join(dataDirectory, 'cache'),
      signal,
      (currentFile) => sendProgressEvent('installProgress', { currentFile }),
    );
    sendProgressEvent('optimizationReady', {
      gamePath: game,
      enabled: await getOptimization(game),
    });
    return releaseId;
  },
  launch: (game) =>
    new Promise<void>((resolve, reject) => {
      const child = spawn(path.join(game, 'valheim.exe'), [], {
        cwd: game,
        shell: false,
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
      });
      child.once('error', reject);
      child.once('spawn', () => {
        childRunning = true;
        child.unref();
        resolve();
      });
      child.once('exit', () => {
        childRunning = false;
        sendProgressEvent('gameState', { running: false });
      });
    }),
});
export async function messageHandler(message: MessageEvent) {
  try {
    const { event, data } = JSON.parse(String(message.data));
    if (event === 'Hello') {
      sendProgressEvent('extensionReady', {});
      return;
    }
    if (event === 'pong') {
      receivedPong();
      return;
    }
    if (event === 'terminate') {
      await shutdown();
      return;
    }
    if (
      [
        'LoadFiles',
        'LaunchGame',
        'EnableValheimOptimization',
        'DisableValheimOptimization',
      ].includes(event)
    ) {
      if (typeof data?.valheimPath !== 'string' || !path.isAbsolute(data.valheimPath))
        throw new Error('Неверный путь к игре');
      if (event === 'LoadFiles') await controller.update(data.valheimPath);
      else if (event === 'LaunchGame') await controller.launch(data.valheimPath);
      else {
        await controller.configure(async () => {
          const enabled = event === 'EnableValheimOptimization';
          await setOptimization(data.valheimPath, enabled);
          sendProgressEvent('optimizationReady', { enabled, gamePath: data.valheimPath });
        });
      }
    }
  } catch (error) {
    sendProgressEvent('operationError', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
