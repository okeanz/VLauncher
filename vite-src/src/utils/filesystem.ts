import { filesystem } from '@neutralinojs/lib';

export const isDirectoryExists = async (relative: string) => {
  try {
    await filesystem.getStats(relative);
    return true;
  } catch {
    return false;
  }
};
