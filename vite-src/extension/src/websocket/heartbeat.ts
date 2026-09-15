import { makeSend } from './setup-ws.js';
import type WS from 'ws';
import { shutdown } from '../on-exit.js';
let timer: NodeJS.Timeout | undefined;
let lastPong = Date.now();
export function startHeartbeat(ws: WS) {
  stopHeartbeat();
  lastPong = Date.now();
  timer = setInterval(() => {
    if (Date.now() - lastPong > 30000) {
      void shutdown(1);
      return;
    }
    if (ws.readyState === ws.OPEN) makeSend()({ event: 'ping', data: {} });
  }, 5000);
}
export function receivedPong() {
  lastPong = Date.now();
}
export function stopHeartbeat() {
  clearInterval(timer);
  timer = undefined;
}
