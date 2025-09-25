import { IMessageEvent } from 'websocket';
import { logError, logInfo } from './utils/logger.ts';
import { sendOperationStart, sendOperationComplete } from './ws-events/progress-events.js';

import { fetchArchive } from './handlers/fetch-archive.js';
import {
  enableValheimOptimization,
  disableValheimOptimization,
} from './handlers/valheim-optimization.js';
import process from 'process';
import { receivedPong } from './websocket/heartbeat.js';

export const messageHandler = async (e: IMessageEvent) => {
  try {
    const { event, data } = JSON.parse(e.data as string);

    if (event === 'LoadFiles') {
      logInfo(`Processing LoadFiles...`);

      // Отправляем событие начала общей операции
      sendOperationStart('download', 3); // 3 архива для загрузки

      // Загружаем и распаковываем архивы
      await fetchArchive('patchers');
      await fetchArchive('config');
      await fetchArchive('BepInEx');

      // Отправляем событие завершения общей операции
      sendOperationComplete();
    }

    if (event === 'EnableValheimOptimization') {
      await enableValheimOptimization(data.valheimPath);
    }

    if (event === 'DisableValheimOptimization') {
      await disableValheimOptimization(data.valheimPath);
    }

    if (event === 'pong') {
      receivedPong();
    }

    if (event === 'terminate') {
      logInfo(`Processing Terminate...`);
      setTimeout(() => {
        process.exit(0);
      }, 500);
    }
  } catch (e) {
    logError(e);
  }
};
