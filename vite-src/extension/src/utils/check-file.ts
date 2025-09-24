import fs from 'fs';
import crypto from 'crypto';
import { logError, logInfo } from './logger.js';

type CheckFileResult = {
  found: boolean;
  checksum?: string;
};

export const checkFile = (path: string): CheckFileResult => {
  logInfo(`[checkFile] ${path}`);
  try {
    if (fs.existsSync(path)) {
      const fileBuffer = fs.readFileSync(path);
      const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      return {
        found: true,
        checksum,
      };
    }
  } catch (e) {
    logError(e);
  }
  return {
    found: false,
  };
};
