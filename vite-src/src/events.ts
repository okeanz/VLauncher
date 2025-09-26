import { app, events, extensions } from '@neutralinojs/lib';
import { store } from '@/shared/store';
import {
  completeOperation,
  setError,
  startOperation,
  updateProgress,
} from '@/features/progress/progress.slice.ts';
import { logInfo } from '@/utils/logInfo.ts';

export const registerEvents = async () => {
  await events.on('windowClose', async () => {
    await extensions.dispatch('fileLoader', 'terminate');
    await app.killProcess();
  });
  await events.on('broadcast', (ev) => {
    console.log('Broadcast', ev.detail);
  });
  await events.on('extensionToApp', async (ev) => {
    // Обрабатываем события прогресса
    const { event, data } = ev.detail;

    switch (event) {
      case 'operationStart':
        store.dispatch(
          startOperation({
            operation: data.operation,
            totalFiles: data.totalFiles,
            totalSize: data.totalSize,
          }),
        );
        break;

      case 'progressUpdate':
        store.dispatch(
          updateProgress({
            progress: data.progress,
            currentFile: data.currentFile,
            downloadedSize: data.downloadedSize,
            extractedFiles: data.extractedFiles,
          }),
        );
        break;

      case 'operationComplete':
        store.dispatch(completeOperation());
        break;

      case 'operationError':
        store.dispatch(setError(data.error));
        break;

      case 'ping':
        await extensions.dispatch('fileLoader', 'pong');
        break;
    }
  });
  await events.on('log', (ev) => {
    logInfo('[extension-log] ', ev.detail);
  });
  await events.on('extClientConnect', (ev) => {
    logInfo('extClientConnect', ev.detail);
  });
};
