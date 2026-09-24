import type { MessageEvent } from 'ws';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Controller } from './controller.js';
import {
  installRelease,
  fetchManifest,
  fetchServers,
  releaseInfo,
  serverReady,
  validServerId,
  type LauncherServer,
} from './updater.js';
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
function apiBase() {
  const base = process.env.VITE_API_URL;
  if (!base) throw new Error('Не настроен адрес сервера обновлений');
  return base;
}
async function findServer(id: string) {
  const server = (await fetchServers(apiBase(), AbortSignal.timeout(15000))).find(
    (s) => s.id === id,
  );
  if (!server) throw new Error('Выбранного сервера больше нет, выберите другой');
  return server;
}
export const releasePollInterval = 30000;
/** A server that is still loading is polled faster, so the launch button opens as soon as the game listens. */
export const startingPollInterval = 10000;
let releaseTimer: ReturnType<typeof setInterval> | undefined;
let startingTimer: ReturnType<typeof setTimeout> | undefined;
let selectedServer = 'main';
async function pollServers() {
  let servers: LauncherServer[] | null = null;
  try {
    servers = await fetchServers(apiBase(), AbortSignal.timeout(15000));
    sendProgressEvent('serverList', { servers });
  } catch {
    sendProgressEvent('serverList', { servers: null });
  }
  await controller.checkRelease(selectedServer);
  const selected = servers?.find((s) => s.id === selectedServer);
  clearTimeout(startingTimer);
  if (selected && !serverReady(selected) && selected.running !== false) {
    startingTimer = setTimeout(() => void pollServers(), startingPollInterval);
    startingTimer.unref();
  }
}
export function watchRelease() {
  void pollServers();
  if (releaseTimer) return;
  releaseTimer = setInterval(() => void pollServers(), releasePollInterval);
  releaseTimer.unref();
}
export const controller = new Controller({
  running: gameRunning,
  notify: sendProgressEvent,
  install: async (game, server, signal) => {
    if (!path.isAbsolute(game)) throw new Error('Укажите абсолютный путь к игре');
    if (!(await fs.stat(path.join(game, 'valheim.exe'))).isFile())
      throw new Error('Valheim не найден');
    const release = await installRelease(
      game,
      apiBase(),
      path.join(dataDirectory, 'cache'),
      signal,
      (currentFile, percent) => sendProgressEvent('installProgress', { currentFile, percent }),
      fetch,
      server,
    );
    sendProgressEvent('optimizationReady', {
      gamePath: game,
      enabled: await getOptimization(game),
    });
    return release;
  },
  currentRelease: async (server) =>
    releaseInfo(await fetchManifest(apiBase(), AbortSignal.timeout(15000), fetch, server)),
  launch: async (game, id) => {
    const server = await findServer(id);
    if (server.running === false) throw new Error(`Сервер «${server.name}» остановлен`);
    if (!serverReady(server))
      throw new Error(
        server.state === 'starting' || server.state === 'preparing'
          ? `Сервер «${server.name}» ещё запускается, подождите`
          : `Сервер «${server.name}» не отвечает`,
      );
    // Valheim joins host:port passed as +connect right after the main menu loads.
    const args = server.address ? ['+connect', server.address] : [];
    await new Promise<void>((resolve, reject) => {
      const child = spawn(path.join(game, 'valheim.exe'), args, {
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
    });
  },
});
export async function messageHandler(message: MessageEvent) {
  try {
    const { event, data } = JSON.parse(String(message.data));
    if (event === 'Hello') {
      sendProgressEvent('extensionReady', {});
      watchRelease();
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
    if (event === 'SelectServer') {
      if (!validServerId(data?.serverId)) throw new Error('Неверный сервер');
      selectedServer = data.serverId;
      void pollServers();
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
      if (event === 'LoadFiles' || event === 'LaunchGame') {
        const server = data.serverId ?? 'main';
        if (!validServerId(server)) throw new Error('Неверный сервер');
        if (event === 'LoadFiles') await controller.update(data.valheimPath, server);
        else await controller.launch(data.valheimPath, server);
      } else {
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
