import { MantineColor } from '@mantine/core';

type ServerStatus = { name: string; color: MantineColor; isLoading: boolean; isReady: boolean };

export enum ServerStatusTypes {
  success = 'success',
  loading = 'loading',
  failure = 'failure',
}

export const serverStatus = {
  success: {
    name: 'Онлайн',
    color: 'green',
    isLoading: false,
    isReady: true,
  },
  loading: {
    name: 'Ждем ответ',
    color: 'orange',
    isLoading: true,
    isReady: false,
  },
  failure: {
    name: 'Не в сети',
    color: 'red',
    isLoading: false,
    isReady: false,
  },
} satisfies Record<ServerStatusTypes, ServerStatus>;
