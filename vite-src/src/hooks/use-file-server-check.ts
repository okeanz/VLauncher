import { useAppSelector } from '@/shared/store/types';
import { fileServerState } from '@/features/progress/progress.slice';
import { serverStatus, ServerStatusTypes } from '@/constants/server-status.ts';

export const useFileServerCheck = () => {
  const state = useAppSelector((s) => fileServerState(s.progress));
  if (state === 'loading') return serverStatus[ServerStatusTypes.loading];
  if (state === 'online') return serverStatus[ServerStatusTypes.success];
  return serverStatus[ServerStatusTypes.failure];
};
