import { createAsyncThunk } from '@reduxjs/toolkit';
import { extensions } from '@neutralinojs/lib';
import { resetProgress } from '@/features/progress/progress.slice';

export const loadArchives = createAsyncThunk(
  'app/loadArchives',
  async (valheimPath: string, { dispatch }) => {
    // Сбрасываем предыдущий прогресс
    dispatch(resetProgress());

    // Отправляем событие в extension
    await extensions.dispatch('fileLoader', 'LoadFiles', { valheimPath });
  },
);
