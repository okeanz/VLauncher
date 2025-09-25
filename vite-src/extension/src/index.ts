import fs from 'fs';
import process from 'process';

import { setupWs } from './websocket/setup-ws.ts';
import { logInfo } from './utils/logger.ts';
import { registerExitEvents } from './on-exit.js';

logInfo('Starting extension...');
logInfo('Awaiting input...');

// Obtain required params to start a WS connection from stdIn.
const processInput = JSON.parse(fs.readFileSync(process.stdin.fd, 'utf-8'));

const NL_PORT = processInput.nlPort;
const NL_TOKEN = processInput.nlToken;
const NL_CTOKEN = processInput.nlConnectToken;
const NL_EXTID = processInput.nlExtensionId;

logInfo(`input: ${JSON.stringify(processInput)}`);

setupWs({ NL_PORT, NL_TOKEN, NL_EXTID, NL_CTOKEN });

registerExitEvents();
