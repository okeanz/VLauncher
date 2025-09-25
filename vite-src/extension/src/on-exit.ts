import { logInfo } from './utils/logger.js';
import { client } from './websocket/setup-ws.js';
import { stopHeartbeat } from './websocket/heartbeat.js';

function cleanup() {
  logInfo('Exit process...');
  stopHeartbeat();
  if (client && client.readyState === client.OPEN) {
    client.close(1000, 'App shutting down');
  }
}

export const registerExitEvents = () => {
  process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });
  process.on('exit', cleanup);
};
