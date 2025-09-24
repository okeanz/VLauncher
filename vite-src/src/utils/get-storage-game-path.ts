import { storage } from '@neutralinojs/lib';
import { gamePathKey } from '@/constants/storage-keys.ts';
import { logInfo } from '@/utils/logInfo.ts';

export const getStorageGamePath = async () => {
  try {
    const storageGamePath = await storage.getData(gamePathKey);
    if (storageGamePath) {
      logInfo(`Found storageGamePath: ${storageGamePath}`);
      return storageGamePath;
    }
  } catch {
    logInfo(`storageGamePath key not exists`);
    return '';
  }
};
