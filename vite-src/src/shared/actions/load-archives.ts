import { createAsyncThunk } from '@reduxjs/toolkit';
import { extensions } from '@neutralinojs/lib';
import { beginInstall, setError, type ProgressState } from '@/features/progress/progress.slice';
export const loadArchives = createAsyncThunk(
  'app/loadArchives',
  async (valheimPath: string, { dispatch }) => {
    dispatch(beginInstall(valheimPath));
    try {
      await extensions.dispatch('fileLoader', 'LoadFiles', { valheimPath });
    } catch {
      dispatch(setError('Не удалось связаться с установщиком'));
    }
  },
  {
    condition: (game, { getState }) => {
      const { progress } = getState() as { progress: ProgressState };
      return Boolean(
        game &&
          progress.connected &&
          !progress.isLoading &&
          !progress.running &&
          !progress.launching &&
          !progress.configuring,
      );
    },
  },
);
