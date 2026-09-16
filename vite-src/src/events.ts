import { app, events, extensions } from '@neutralinojs/lib';
import { store } from '@/shared/store';
import {
  beginInstall,
  installReady,
  updateProgress,
  setError,
  setConnected,
  setRunning,
  setConfiguring,
} from '@/features/progress/progress.slice';
import { setOptimizationConfirmed } from '@/features/settings/settings.slice';
import { loadArchives } from '@/shared/actions/load-archives';
let closing = false;
let closeTimeout: ReturnType<typeof setTimeout> | undefined;
let helloTimer: ReturnType<typeof setInterval> | undefined;
export const registerEvents = async () => {
  closing = false;
  await events.on('windowClose', async () => {
    if (closing) return;
    closing = true;
    if (helloTimer) clearInterval(helloTimer);
    if (!store.getState().progress.connected) {
      await app.killProcess();
      return;
    }
    closeTimeout = setTimeout(() => {
      void app.killProcess();
    }, 5000);
    try {
      await extensions.dispatch('fileLoader', 'terminate');
    } catch {
      clearTimeout(closeTimeout);
      await app.killProcess();
    }
  });
  await events.on('extensionToApp', async (ev) => {
    const { event, data } = ev.detail;
    switch (event) {
      case 'extensionReady': {
        if (helloTimer) clearInterval(helloTimer);
        const wasConnected = store.getState().progress.connected;
        store.dispatch(setConnected(true));
        const s = store.getState().settings;
        if (!wasConnected && s.valheimPathValid) void store.dispatch(loadArchives(s.valheimPath));
        break;
      }
      case 'installStarted':
        store.dispatch(beginInstall(data.gamePath));
        break;
      case 'installReady':
        store.dispatch(installReady(data.gamePath));
        break;
      case 'installProgress':
        store.dispatch(updateProgress(data.currentFile));
        break;
      case 'operationError':
        store.dispatch(setError(data.error));
        break;
      case 'gameState':
        store.dispatch(setRunning(data.running));
        break;
      case 'optimizationReady':
        if (data.gamePath === store.getState().settings.valheimPath)
          store.dispatch(setOptimizationConfirmed(data.enabled));
        store.dispatch(setConfiguring(false));
        break;
      case 'shutdownComplete':
        if (closing) {
          clearTimeout(closeTimeout);
          await app.killProcess();
        }
        break;
      case 'ping':
        await extensions.dispatch('fileLoader', 'pong');
        break;
    }
  });
  await events.on('extClientDisconnect', () => {
    store.dispatch(setConnected(false));
  });
  await events.on('ready', () => {
    let attempts = 0;
    const hello = () => {
      if (++attempts > 30) {
        clearInterval(helloTimer);
        store.dispatch(
          setError('Установщик не запустился. Перезапустите лаунчер и проверьте журнал.'),
        );
        return;
      }
      void extensions.dispatch('fileLoader', 'Hello').catch(() => {});
    };
    helloTimer = setInterval(hello, 1000);
    hello();
  });
};
