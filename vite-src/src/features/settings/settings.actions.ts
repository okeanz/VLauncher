import { createAsyncThunk } from '@reduxjs/toolkit';
import { checkValheimExe } from '@/utils/check-valheim-exe';
import { storage } from '@neutralinojs/lib';
import { gamePathKey } from '@/constants/storage-keys';
import { loadArchives } from '@/shared/actions/load-archives';
import { resetProgress, setError, type ProgressState } from '@/features/progress/progress.slice';
export const setValheimPath = createAsyncThunk(
  'settings/setValheimPath',
  async (directoryPath: string, { dispatch }) => {
    dispatch(resetProgress());
    const isValid = Boolean(directoryPath) && (await checkValheimExe(directoryPath));
    if (isValid) {
      try {
        await storage.setData(gamePathKey, directoryPath);
      } catch (error) {
        dispatch(setError('Не удалось сохранить путь к игре'));
        throw error;
      }
      void dispatch(loadArchives(directoryPath));
    }
    return { path: directoryPath, isValid };
  },
  {
    condition: (_path, { getState }) => {
      const { progress, settings } = getState() as {
        progress: ProgressState;
        settings: { selecting: boolean };
      };
      return (
        !settings.selecting &&
        !progress.isLoading &&
        !progress.running &&
        !progress.launching &&
        !progress.configuring
      );
    },
  },
);
