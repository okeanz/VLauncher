import fs from 'fs';
import process from 'process';

import { setupWs } from './websocket/setup-ws.ts';
import { logInfo } from './utils/logger.ts';
import { extensionCleanup } from './on-exit.js';
import { ensureSingleInstance } from './types/pidlock-promise.js';
import { loadEnv } from './load-env.js';

loadEnv();

logInfo('Starting extension...');
logInfo(`ENV: ${process.env.VITE_API_URL}`);

ensureSingleInstance('./lockfile', extensionCleanup).then(() => {
  logInfo('Awaiting input...');

  // Obtain required params to start a WS connection from stdIn.
  const processInput = JSON.parse(fs.readFileSync(process.stdin.fd, 'utf-8'));

  const NL_PORT = processInput.nlPort;
  const NL_TOKEN = processInput.nlToken;
  const NL_CTOKEN = processInput.nlConnectToken;
  const NL_EXTID = processInput.nlExtensionId;

  logInfo(`input: ${JSON.stringify(processInput)}`);

  setupWs({ NL_PORT, NL_TOKEN, NL_EXTID, NL_CTOKEN });
});
