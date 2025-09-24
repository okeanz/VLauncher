import { logInfo } from './logger';
import process from 'process';
import { w3cwebsocket as WS } from 'websocket';
import { messageHandler } from './messageHandler';

type setupWsParams = {
  NL_PORT: string;
  NL_EXTID: string;
  NL_CTOKEN: string;
  NL_TOKEN: string;
};

export const setupWs = ({ NL_PORT, NL_CTOKEN, NL_TOKEN, NL_EXTID }: setupWsParams) => {
  const client = new WS(
    `ws://localhost:${NL_PORT}?extensionId=${NL_EXTID}&connectToken=${NL_CTOKEN}`,
  );

  logInfo('START');

  client.onerror = () => logInfo('Connection error!', 'ERROR');
  client.onopen = () => logInfo('Connected');
  client.onclose = () => {
    logInfo('Connection closed!', 'ERROR');
    process.exit();
  };

  client.onmessage = messageHandler(NL_TOKEN, client);
};
