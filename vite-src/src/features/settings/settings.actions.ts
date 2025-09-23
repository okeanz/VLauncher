import { createAsyncThunk } from '@reduxjs/toolkit';
import { checkValheimExe } from '@/utils/check-valheim-exe.ts';

export const setValheimPath = createAsyncThunk(
  'settings/setValheimPath',
  async (directoryPath: string) => {
    return {
      path: directoryPath,
      isValid: await checkValheimExe(directoryPath),
    };
  },
);
