import { logInfo } from './utils/logger.js';
import { client } from './websocket/setup-ws.js';
import { stopHeartbeat } from './websocket/heartbeat.js';
import { abortExecution } from './handlers/fetch-archive.js';

export function extensionCleanup() {
  logInfo('Exit process...');
  abortExecution();
  stopHeartbeat();
  if (client && client.readyState === client.OPEN) {
    client.close(1000, 'App shutting down');
  }
}
