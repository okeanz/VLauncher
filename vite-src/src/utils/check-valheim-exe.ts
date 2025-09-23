import { filesystem } from '@neutralinojs/lib';
import {logError} from "@/utils/log.ts";

export const checkValheimExe = async (directoryPath: string) => {
  try {
      const stats = await filesystem.getStats(directoryPath + '/valheim.exe');
      return stats.isFile;
  } catch (e) {
      logError(e);
      return false;
  }
};
