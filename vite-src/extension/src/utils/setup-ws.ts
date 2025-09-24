import { logError, logInfo } from './logger.ts';
import process from 'process';
import { w3cwebsocket as WS } from 'websocket';
import { messageHandler } from '../message-handler.ts';
import { v4 as uuidv4 } from 'uuid/dist/index.js';

type setupWsParams = {
  NL_PORT: string;
  NL_EXTID: string;
  NL_CTOKEN: string;
  NL_TOKEN: string;
};

let client: WS;
let accessToken: string;

export const setupWs = ({ NL_PORT, NL_CTOKEN, NL_TOKEN, NL_EXTID }: setupWsParams) => {
  try {
    client = new WS(`ws://localhost:${NL_PORT}?extensionId=${NL_EXTID}&connectToken=${NL_CTOKEN}`);
    accessToken = NL_TOKEN;

    logInfo('START');

    client.onerror = () => logInfo('Connection error!');
    client.onopen = () => logInfo('Connected');
    client.onclose = () => {
      logInfo('Connection closed!');
      process.exit();
    };

    client.onmessage = messageHandler;
  } catch (e) {
    logError(e);
  }
};

export const makeSend =
  (event: 'extensionToApp' | 'log' = 'extensionToApp') =>
  (data: object | string) => {
    try {
      if (!client || !accessToken) return;

      const msg = JSON.stringify({
        id: uuidv4(),
        method: 'app.broadcast',
        accessToken,
        data: {
          event,
          data,
        },
      });

      client.send(msg);
    } catch {}
  };
