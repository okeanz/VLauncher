import { createAsyncThunk } from '@reduxjs/toolkit';
import { checkValheimExe } from '@/utils/check-valheim-exe.ts';
import { storage } from '@neutralinojs/lib';
import { gamePathKey } from '@/constants/storage-keys.ts';
import { logInfo } from '@/utils/logInfo.ts';

export const setValheimPath = createAsyncThunk(
  'settings/setValheimPath',
  async (directoryPath: string) => {
    const isValid = await checkValheimExe(directoryPath);

    if (isValid) {
      logInfo(`Setting storageGamePath: ${directoryPath}`);
      await storage.setData(gamePathKey, directoryPath);
    }

    return {
      path: directoryPath,
      isValid,
    };
  },
);
