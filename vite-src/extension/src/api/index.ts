import axios from 'axios/index.js';
import { logInfo } from '../utils/logger.js';

export const api = axios.create();

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
