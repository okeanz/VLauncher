import { IMessageEvent } from 'websocket';
import { logError, logInfo } from './utils/logger.ts';

import { makeSend } from './utils/setup-ws.js';
import { fetchArchive } from './handlers/fetch-archive.js';

export const messageHandler = async (e: IMessageEvent) => {
  try {
    const { event } = JSON.parse(e.data as string);

    if (event === 'LoadFiles') {
      const send = makeSend();
      send({ test: 123 });
      logInfo(`Processing LoadFiles...`);

      // Загружаем и распаковываем архивы
      await fetchArchive('patchers');
      await fetchArchive('config');
      await fetchArchive('BepInEx');
    }
  } catch (e) {
    logError(e);
  }
};
