import { checkFile } from '../utils/check-file.js';
import { logError, logInfo } from '../utils/logger.js';
import { getFile, getFileChecksum } from '../api/files.js';
import { pipeline } from 'stream/promises';
import fs from 'fs';

export const fetchArchive = async (archiveName: string) => {
  try {
    const checkResult = checkFile(`./cache/${archiveName}.zip`);
    logInfo(`[${archiveName}.zip] checkResult ${JSON.stringify(checkResult)}`);

    if (!checkResult.found) {
      const configArchive = await getFile(archiveName);

      logInfo(`[${archiveName}.zip] file size: ${configArchive.headers['content-length']}`);

      await pipeline(configArchive.data, fs.createWriteStream(`./cache/${archiveName}.zip`));

      logInfo(`[${archiveName}.zip] file saved!`);
    } else {
      const serverChecksum = await getFileChecksum(archiveName);
      const isIdentical = serverChecksum.data === checkResult.checksum;
      const isIdenticalMsg = isIdentical ? '✔️ Identical' : '❌ Different';
      logInfo(
        `[${archiveName}.zip] checksum: \nserver checksum: ${serverChecksum.data}\nclient checksum: ${checkResult.checksum}\nResult: ${isIdenticalMsg}`,
      );
    }
  } catch (e) {
    logError(e);
  }
};
