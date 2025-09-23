import { ServerStatusTypes } from '@/constants/server-status.ts';

export const getServerStatus = (isDataAvailable: boolean, isFetching: boolean) => {
  if (isFetching) {
    return ServerStatusTypes.loading;
  }
  if (isDataAvailable) {
    return ServerStatusTypes.success;
  } else {
    return ServerStatusTypes.failure;
  }
};
