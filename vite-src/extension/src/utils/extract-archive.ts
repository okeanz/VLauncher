import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { logError, logInfo } from './logger.js';
import {
  sendOperationStart,
  sendProgressUpdate,
  sendOperationComplete,
} from '../ws-events/progress-events.js';

/**
 * Распаковывает ZIP архив в указанную папку
 * @param archivePath - путь к ZIP архиву
 * @param extractPath - путь для распаковки
 */
export const extractArchive = async (archivePath: string, extractPath: string): Promise<void> => {
  try {
    logInfo(`[extractArchive] Extracting ${archivePath} to ${extractPath}`);

    // Создаем папку для распаковки если она не существует
    if (!fs.existsSync(extractPath)) {
      fs.mkdirSync(extractPath, { recursive: true });
    }

    const zip = new AdmZip(archivePath);
    const entries = zip.getEntries();

    logInfo(`[extractArchive] Found ${entries.length} entries in archive`);

    // Отправляем событие начала операции
    sendOperationStart('extract', entries.length);

    let extractedCount = 0;

    for (const entry of entries) {
      if (!entry.isDirectory) {
        const entryPath = path.join(extractPath, entry.entryName);

        // Создаем папку для файла если она не существует
        if (!fs.existsSync(path.dirname(entryPath))) {
          fs.mkdirSync(path.dirname(entryPath), { recursive: true });
        }

        // Извлекаем файл
        const data = entry.getData();
        fs.writeFileSync(entryPath, data);
        extractedCount++;

        // Отправляем обновление прогресса
        const progress = Math.round((extractedCount / entries.length) * 100);
        sendProgressUpdate(progress, entry.entryName, undefined, extractedCount);
      }
    }

    // Отправляем событие завершения операции
    sendOperationComplete();

    logInfo(
      `[extractArchive] Successfully extracted ${extractedCount} files from ${archivePath} to ${extractPath}`,
    );
  } catch (e) {
    logError(
      `[extractArchive] Error extracting ${archivePath}: ${e instanceof Error ? e.message : String(e)}`,
    );
    throw e;
  }
};
