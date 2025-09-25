import { makeSend } from '../websocket/setup-ws.js';

export function logInfo(message: string | object, second?: object | string) {
  const msg = typeof message === 'string' ? message : JSON.stringify(message, null, 2);
  const msgSecond = typeof second === 'string' ? second : JSON.stringify(second, null, 2);

  const toLog = `\n${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })} - [INFO] ${msg} ${msgSecond ? `\n${msgSecond}` : ''}`;

  console.log(toLog);

  const sendLog = makeSend('log');
  sendLog(toLog);
}

export function logError(e: unknown) {
  if (e instanceof Error) {
    logInfo(`Error ${e.message}\n${e.stack}`);
  } else {
    logInfo(`Unknown error`);
    logInfo(JSON.stringify(e));
  }
}
