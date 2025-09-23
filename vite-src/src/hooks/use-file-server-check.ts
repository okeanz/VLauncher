import { useGetFileServerPingQuery } from '@/shared/services/file-server.ts';
import { serverStatus, ServerStatusTypes } from '@/constants/server-status.ts';

export const useFileServerCheck = () => {
  const { data, error } = useGetFileServerPingQuery(undefined, {
    pollingInterval: 10000,
  });

  const isActive = !!data && !error;

  if (isActive) return serverStatus[ServerStatusTypes.success];
  return serverStatus[ServerStatusTypes.failure];
};
