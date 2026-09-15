import { makeSend } from '../websocket/setup-ws.js';
export function sendProgressEvent(event: string, data: object) {
  makeSend('extensionToApp')({ event, data });
}
