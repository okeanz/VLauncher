import { IMessageEvent } from 'websocket';
import { logInfo } from './logger';
// @ts-expect-error some package error
import { v4 as uuidv4 } from 'uuid';
import { w3cwebsocket as WS } from 'websocket';

export const messageHandler = (NL_TOKEN: string, client: WS) => (e: IMessageEvent) => {
  const { event } = JSON.parse(e.data as string);

  if (event === 'eventToExtension') {
    logInfo(e.data as string);

    client.send(
      JSON.stringify({
        id: uuidv4(),
        method: 'app.broadcast',
        accessToken: NL_TOKEN,
        data: { event: 'eventFromExtension', data: 'Hello app!' },
      }),
    );
  }
};
