import { checkFile } from '../utils/check-file.js';
import { logError, logInfo } from '../utils/logger.js';
import { getFile, getFileChecksum } from '../api/files.js';
import { pipeline } from 'stream/promises';
import fs from 'fs';
import { extractArchive } from '../utils/extract-archive.js';
import { cleanDirectory } from '../utils/clean-directory.js';

/**
 * Загружает архив с сервера и распаковывает его в папку ./cache/unpacked/{archiveName}
 * Очищает папку распаковки только если хэш архива не совпадает с серверным
 */
export const fetchArchive = async (archiveName: string) => {
  try {
    const archivePath = `./cache/${archiveName}.zip`;
    const extractPath = `./cache/unpacked/${archiveName}`;
    
    // Проверяем существование архива и его хэш
    const checkResult = checkFile(archivePath);
    logInfo(`[${archiveName}.zip] checkResult ${JSON.stringify(checkResult)}`);

    let needsDownload = false;

    if (!checkResult.found) {
      // Архив не найден - нужно загрузить
      needsDownload = true;
    } else {
      // Архив найден - проверяем хэш с сервером
      const serverChecksum = await getFileChecksum(archiveName);
      const isIdentical = serverChecksum.data === checkResult.checksum;
      logInfo(
        `[${archiveName}.zip] checksum: \nserver checksum: ${serverChecksum.data}\nclient checksum: ${checkResult.checksum}\nResult: ${isIdentical ? '✔️ Identical' : '❌ Different'}`,
      );
      
      if (!isIdentical) {
        // Хэш не совпадает - нужно обновить архив
        needsDownload = true;
        // Очищаем папку распаковки перед обновлением
        await cleanDirectory(extractPath);
        logInfo(`[${archiveName}.zip] Cleaned extraction directory for update`);
      }
    }

    // Загружаем архив если необходимо
    if (needsDownload) {
      const configArchive = await getFile(archiveName);
      logInfo(`[${archiveName}.zip] file size: ${configArchive.headers['content-length']}`);
      await pipeline(configArchive.data, fs.createWriteStream(archivePath));
      logInfo(`[${archiveName}.zip] file saved!`);
    }

    // Распаковываем если архив был загружен или папка распаковки пуста
    if (needsDownload || !fs.existsSync(extractPath) || fs.readdirSync(extractPath).length === 0) {
      await extractArchive(archivePath, extractPath);
      logInfo(`[${archiveName}.zip] extracted to ${extractPath}`);
    }
  } catch (e) {
    logError(e);
  }
};
