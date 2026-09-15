import { logError, logInfo } from '../utils/logger.ts';
import { shutdown } from '../on-exit.js';
import WS from 'ws';
import { messageHandler } from '../message-handler.ts';
import { randomUUID } from 'crypto';
import { startHeartbeat, stopHeartbeat } from './heartbeat.js';

type setupWsParams = {
  NL_PORT: string;
  NL_EXTID: string;
  NL_CTOKEN: string;
  NL_TOKEN: string;
};

export let client: WS;
let accessToken: string;

export const setupWs = ({ NL_PORT, NL_CTOKEN, NL_TOKEN, NL_EXTID }: setupWsParams) => {
  try {
    client = new WS(
      `ws://127.0.0.1:${NL_PORT}?extensionId=${encodeURIComponent(NL_EXTID)}&connectToken=${encodeURIComponent(NL_CTOKEN)}`,
    );
    accessToken = NL_TOKEN;

    logInfo('START');

    client.onopen = () => {
      logInfo('Connected');
      startHeartbeat(client);
    };

    client.onclose = () => {
      logInfo('Connection closed!');
      stopHeartbeat();
      void shutdown();
    };

    client.onerror = () => {
      logInfo('Connection error!2');

      stopHeartbeat();
      void shutdown();
    };

    client.onmessage = messageHandler;
  } catch {
    logError('Unable to connect extension');
    void shutdown(1);
  }
};

export const makeSend =
  (event: 'extensionToApp' | 'log' = 'extensionToApp') =>
  (data: object | string) => {
    try {
      if (!client || !accessToken || client.readyState !== WS.OPEN) return;

      const msg = JSON.stringify({
        id: randomUUID(),
        method: 'app.broadcast',
        accessToken,
        data: {
          event,
          data,
        },
      });

      client.send(msg);
    } catch (e) {
      console.log('send error', e);
    }
  };
