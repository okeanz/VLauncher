import { IMessageEvent } from 'websocket';
import { logError, logInfo } from './utils/logger.ts';

import { fetchArchive } from './handlers/fetch-archive.js';
import { 
  enableValheimOptimization, 
  disableValheimOptimization
} from './handlers/valheim-optimization.js';

export const messageHandler = async (e: IMessageEvent) => {
  try {
    const { event, data } = JSON.parse(e.data as string);

    if (event === 'LoadFiles') {
      logInfo(`Processing LoadFiles...`);

      // Загружаем и распаковываем архивы
      await fetchArchive('patchers');
      await fetchArchive('config');
      await fetchArchive('BepInEx');
    }

    if (event === 'EnableValheimOptimization') {
      await enableValheimOptimization(data.valheimPath);
    }

    if (event === 'DisableValheimOptimization') {
      await disableValheimOptimization(data.valheimPath);
    }
  } catch (e) {
    logError(e);
  }
};
