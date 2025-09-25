import { makeSend } from './setup-ws.js';
import { w3cwebsocket } from 'websocket';
import { logInfo } from '../utils/logger.js';

let pingTimer: NodeJS.Timeout | null = null;
let pongTimeout: NodeJS.Timeout | null = null;

const pingEvery = 5000;
const checkEvery = 2000;

export function startHeartbeat(ws: w3cwebsocket) {
  pingTimer = setInterval(() => {
    const send = makeSend();
    if (ws.readyState === ws.OPEN) {
      send({ event: 'ping' });

      // ждём pong не дольше 2 сек
      if (pongTimeout) clearTimeout(pongTimeout);
      pongTimeout = setTimeout(() => {
        logInfo('ping/pong failed, closing connection ...');
        ws.close();
        process.exit(0);
      }, checkEvery);
    }
  }, pingEvery);
}

export function stopHeartbeat() {
  if (pingTimer) clearInterval(pingTimer);
  if (pongTimeout) clearTimeout(pongTimeout);
}

export function receivedPong() {
  if (pongTimeout) clearTimeout(pongTimeout);
}
