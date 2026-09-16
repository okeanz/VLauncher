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
  setServerRelease,
  setServers,
  type ServerRelease,
} from '@/features/progress/progress.slice';
import { chooseServer } from '@/shared/actions/choose-server';
import { setOptimizationConfirmed } from '@/features/settings/settings.slice';
import { loadArchives } from '@/shared/actions/load-archives';
let closing = false;
let closeTimeout: ReturnType<typeof setTimeout> | undefined;
let helloTimer: ReturnType<typeof setInterval> | undefined;
/** Last server/revision installed automatically; a failed attempt is retried only by the player. */
let autoUpdatedRelease = '';
function syncRelease(release: ServerRelease | null) {
  store.dispatch(setServerRelease(release));
  const { progress, settings } = store.getState();
  const key = release && `${progress.selectedServer}/${release.releaseId}`;
  if (
    !release ||
    !settings.valheimPathValid ||
    (progress.readyServer === progress.selectedServer &&
      progress.readyRelease === release.releaseId) ||
    autoUpdatedRelease === key ||
    !progress.connected ||
    progress.isLoading ||
    progress.running ||
    progress.launching ||
    progress.configuring
  )
    return;
  // Busy states are skipped without remembering the revision, so the next poll retries.
  autoUpdatedRelease = key!;
  void store.dispatch(loadArchives(settings.valheimPath));
}
export const registerEvents = async () => {
  closing = false;
  autoUpdatedRelease = '';
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
        void extensions
          .dispatch('fileLoader', 'SelectServer', {
            serverId: store.getState().progress.selectedServer,
          })
          .catch(() => {});
        const s = store.getState().settings;
        if (!wasConnected && s.valheimPathValid) void store.dispatch(loadArchives(s.valheimPath));
        break;
      }
      case 'installStarted':
        store.dispatch(beginInstall(data.gamePath));
        break;
      case 'installReady':
        store.dispatch(installReady(data.gamePath, data.releaseId, data.serverId ?? 'main'));
        break;
      case 'serverRelease':
        if ((data.serverId ?? 'main') === store.getState().progress.selectedServer)
          syncRelease(data.release ?? null);
        break;
      case 'serverList': {
        store.dispatch(setServers(data.servers ?? null));
        const { selectedServer } = store.getState().progress;
        // A deleted test server falls back to the main one.
        if (data.servers && !data.servers.some((s: { id: string }) => s.id === selectedServer))
          void store.dispatch(chooseServer('main'));
        break;
      }
      case 'installProgress':
        store.dispatch(updateProgress(data.currentFile));
        break;
      case 'operationError':
        store.dispatch(setError(data.error));
        break;
      case 'gameState':
        store.dispatch(setRunning(data.running));
        if (!data.running) syncRelease(store.getState().progress.serverRelease);
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
