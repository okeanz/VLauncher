import fs from 'fs/promises';
import path from 'path';
import { logInfo } from '../utils/logger.js';
import {
  sendOperationComplete,
  sendOperationStart,
  sendProgressUpdate,
} from '../ws-events/progress-events.js';

export let lastUsedPath: string;

/**
 * Создаёт симлинки для всех файлов и папок из src в dest.
 * Если в dest уже что-то есть — удаляет и перезаписывает.
 * Работает под Windows.
 * @param {string} src - путь к оригинальной папке
 * @param {string} dest - путь к папке игры (куда монтировать)
 */
export async function mountSymlinks(src: string, dest: string) {
  lastUsedPath = dest;

  const entries = await fs.readdir(src, { withFileTypes: true });

  sendOperationStart('extract', entries.length);

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    // Удаляем, если уже есть
    try {
      await fs.lstat(destPath);
      await fs.rm(destPath, { recursive: true, force: true });
      logInfo(`Удалено существующее: ${destPath}`);
    } catch {
      // ENOENT — ничего нет, можно создавать
    }

    if (entry.isDirectory()) {
      await fs.symlink(srcPath, destPath, 'junction');
      logInfo(`Папка смонтирована: ${destPath}`);
      sendProgressUpdate(
        Math.round((entries.indexOf(entry) / entries.length) * 100),
        entry.name,
        undefined,
        entries.indexOf(entry),
      );
    } else {
      await fs.symlink(srcPath, destPath, 'file');
      logInfo(`Файл смонтирован: ${destPath}`);
    }
  }

  sendOperationComplete();
}
