import { controller } from './message-handler.js';
import { stopHeartbeat } from './websocket/heartbeat.js';
import { client, makeSend } from './websocket/setup-ws.js';
let release: (() => Promise<void>) | undefined;
let pending: Promise<void> | undefined;
export function setLockRelease(fn: () => Promise<void>) {
  release = fn;
}
export function shutdown(code = 0): Promise<void> {
  return (pending ??= (async () => {
    stopHeartbeat();
    try {
      await controller.stop();
      await release?.();
    } catch (e) {
      console.error('Shutdown failed', e instanceof Error ? e.message : 'unknown error');
      code = 1;
    } finally {
      makeSend()({ event: 'shutdownComplete', data: {} });
      client?.close();
      process.stdin.destroy();
      process.exitCode = code;
    }
  })());
}
