import { createAsyncThunk } from '@reduxjs/toolkit';
import { checkValheimExe } from '@/utils/check-valheim-exe.ts';
import { storage, extensions } from '@neutralinojs/lib';
import { gamePathKey, optimizationKey } from '@/constants/storage-keys.ts';
import { logInfo } from '@/utils/logInfo.ts';
import { loadArchives } from '@/shared/actions/load-archives.ts';

export const setValheimPath = createAsyncThunk(
  'settings/setValheimPath',
  async (directoryPath: string, { dispatch }) => {
    const isValid = await checkValheimExe(directoryPath);

    if (isValid) {
      logInfo(`Setting storageGamePath: ${directoryPath}`);
      await storage.setData(gamePathKey, directoryPath);

      // Инициализируем настройки только если путь валидный
      dispatch(initializeSettings(directoryPath));

      dispatch(loadArchives(directoryPath));
    }

    return {
      path: directoryPath,
      isValid,
    };
  },
);

export const setValheimOptimization = createAsyncThunk(
  'settings/setValheimOptimization',
  async (enabled: boolean) => {
    logInfo(`Setting valheim optimization: ${enabled}`);
    await storage.setData(optimizationKey, enabled.toString());
    return enabled;
  },
);

export const initializeSettings = createAsyncThunk(
  'settings/initializeSettings',
  async (valheimPath: string, { dispatch }) => {
    try {
      if (!valheimPath) {
        logInfo('Valheim path not provided, skipping optimization check');
        return;
      }

      // Получаем значение оптимизации из storage
      const optimizationValue = await storage.getData(optimizationKey);
      const isEnabled = optimizationValue ? optimizationValue === 'true' : true;

      logInfo(`Storage optimization value: ${isEnabled}`);

      // Устанавливаем состояние в Redux
      dispatch(setValheimOptimization(isEnabled));

      // Если оптимизация включена, отправляем событие для проверки и добавления строк в файл
      if (isEnabled) {
        logInfo('Sending event to check and apply optimization settings');
        await extensions.dispatch('fileLoader', 'EnableValheimOptimization', {
          valheimPath: valheimPath,
        });
      }
    } catch (error) {
      logInfo(`Error initializing settings: ${error}`);
      // По умолчанию включено при ошибке
      dispatch(setValheimOptimization(true));
    }
  },
);
