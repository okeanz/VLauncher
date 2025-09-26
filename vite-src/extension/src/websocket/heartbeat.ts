import { makeSend } from './setup-ws.js';
import { w3cwebsocket } from 'websocket';
import { logInfo } from '../utils/logger.js';

let pingTimer: NodeJS.Timeout | null = null;
let pongTimeout: NodeJS.Timeout | null = null;

let heartbeatOnPause = false;

const pingEvery = 5000;
const checkEvery = 4000;

export function startHeartbeat(ws: w3cwebsocket) {
  pingTimer = setInterval(() => {
    const send = makeSend();
    if (ws.readyState === ws.OPEN) {
      send({ event: 'ping' });

      // ждём pong не дольше 2 сек
      if (pongTimeout) clearTimeout(pongTimeout);
      pongTimeout = setTimeout(() => {
        // Дабы не делать голову с воркерами - проще так
        if (heartbeatOnPause) return;

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

export function setHeartbeatPause(pause: boolean = true): void {
  heartbeatOnPause = pause;
}
