import { checkFile } from '../utils/check-file.js';
import { logError, logInfo } from '../utils/logger.js';
import {
  sendOperationStart,
  sendOperationComplete,
  sendOperationError,
  sendProgressUpdate,
} from '../ws-events/progress-events.js';
import { getFile, getFileChecksum } from '../api/files.js';
import { pipeline } from 'stream/promises';
import { PassThrough } from 'stream';
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
    
    // Создаем папку cache если она не существует
    if (!fs.existsSync('./cache')) {
      fs.mkdirSync('./cache', { recursive: true });
      logInfo(`[${archiveName}.zip] Created cache directory`);
    }
    
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
      // Отправляем событие начала загрузки
      sendOperationStart('download', 1);

      const configArchive = await getFile(archiveName);
      const totalSize = parseInt(configArchive.headers['content-length'] || '0');

      logInfo(`[${archiveName}.zip] file size: ${totalSize}`);

      // Создаем поток с отслеживанием прогресса
      let downloadedSize = 0;
      const progressStream = new PassThrough();

      progressStream.on('data', (chunk) => {
        downloadedSize += chunk.length;
        const progress = totalSize > 0 ? Math.round((downloadedSize / totalSize) * 100) : 0;

        // Отправляем обновление прогресса
        sendProgressUpdate(progress, `${archiveName}.zip`, downloadedSize);
      });

      await pipeline(configArchive.data, progressStream, fs.createWriteStream(archivePath));

      logInfo(`[${archiveName}.zip] file saved!`);

      // Отправляем событие завершения загрузки
      sendOperationComplete();
    }

    // Распаковываем если архив был загружен или папка распаковки пуста
    if (needsDownload || !fs.existsSync(extractPath) || fs.readdirSync(extractPath).length === 0) {
      await extractArchive(archivePath, extractPath);
      logInfo(`[${archiveName}.zip] extracted to ${extractPath}`);
    }
  } catch (e) {
    sendOperationError(e instanceof Error ? e.message : String(e));
    logError(e);
  }
};
