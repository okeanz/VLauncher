import { api } from './index.js';

export const getFile = async (name: string) => {
  return await api.get<ReadableStream>(`${process.env.VITE_API_URL}/files/${name}.zip`, {
    responseType: 'stream',
    timeout: 3000,
  });
};

export const getFileChecksum = async (name: string) =>
  await api.get<string>(`${process.env.VITE_API_URL}/filesChecksum/${name}.zip`, {
    responseType: 'text',
  });
