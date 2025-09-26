import { MessageEvent } from 'ws';
import { logError, logInfo } from './utils/logger.ts';
import {
  enableValheimOptimization,
  disableValheimOptimization,
} from './handlers/valheim-optimization.js';
import process from 'process';
import { receivedPong, setHeartbeatPause } from './websocket/heartbeat.js';
import { fetchArchive } from './handlers/fetch-archive.js';

export const messageHandler = async (e: MessageEvent) => {
  try {
    // Не особо важно какое сообщение, если что-то пришло, значит app жив
    receivedPong();
    const { event, data } = JSON.parse(e.data as string);

    if (event === 'LoadFiles') {
      logInfo(`Processing LoadFiles...`);
      // Дабы не делать воркеры, проще так тормознуть на время пинг-понг
      setHeartbeatPause();

      // Загружаем и распаковываем архивы
      await fetchArchive('BepInEx');
      await fetchArchive('patchers');
      await fetchArchive('config');
      setHeartbeatPause(false);
    }

    if (event === 'EnableValheimOptimization') {
      await enableValheimOptimization(data.valheimPath);
    }

    if (event === 'DisableValheimOptimization') {
      await disableValheimOptimization(data.valheimPath);
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
