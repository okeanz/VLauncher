import { IMessageEvent } from 'websocket';
import { logError, logInfo } from './utils/logger.ts';

import { w3cwebsocket as WS } from 'websocket';
import axios from 'axios';
import fs from 'fs';
import { checkFile } from './utils/check-file.js';
import { makeSend } from './utils/setup-ws.js';
import { pipeline } from 'stream/promises';

const api = axios.create();

api.interceptors.request.use((config) => {
  logInfo(`[AXIOS REQUEST] ${config.method?.toUpperCase()} ${config.url}`, {
    headers: config.headers,
    params: config.params,
    data: config.data,
  });
  return config;
});

api.interceptors.response.use(
  (response) => {
    const { config, statusText, headers, data } = response;
    logInfo(
      `[AXIOS RESPONSE] ${config.method?.toUpperCase()} ${config.url} ${statusText}`,
      Number(headers['content-length']) > 200
        ? `-Body length: ${headers['content-length']}-`
        : data,
    );
    return response;
  },
  (response) => {
    const { config, statusText } = response;
    logInfo(
      `[AXIOS RESPONSE FAILED] ${config.method?.toUpperCase()} ${config.url} ${statusText}`,
      response.data,
    );
  },
);

const getFile = async (name: string) =>
  await api.get<ReadableStream>(`${process.env.VITE_API_URL}/files/${name}.zip`, {
    responseType: 'stream',
    timeout: 3000,
  });

const getFileChecksum = async (name: string) =>
  await api.get<string>(`${process.env.VITE_API_URL}/filesChecksum/${name}.zip`, {
    responseType: 'text',
  });

export const messageHandler = async (e: IMessageEvent) => {
  try {
    // logInfo(`Received ${e.data as string}`);

    const { event } = JSON.parse(e.data as string);

    if (event === 'LoadFiles') {
      const send = makeSend();
      logInfo(`Processing LoadFiles...`);
      send({ test: 'text' });

      const checkResult = checkFile('./cache/patchers.zip');
      logInfo(`checkResult ${JSON.stringify(checkResult)}`);

      if (!checkResult.found) {
        const configArchive = await getFile('patchers');

        logInfo(`[patchers.zip] file size: ${configArchive.headers['content-length']}`);

        await pipeline(configArchive.data, fs.createWriteStream('./cache/patchers.zip'));

        logInfo(`[patchers.zip] file saved!`);
      }

      logInfo(checkResult);
    }
  } catch (e) {
    logError(e);
  }
};
