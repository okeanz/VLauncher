import fs from 'fs/promises';
import path from 'path';
import { logInfo } from '../utils/logger.js';

/**
 * Удаляет все симлинки в указанной директории (только верхний уровень).
 * Обычные файлы и папки не трогает.
 * @param {string} targetDir - путь к папке, где нужно очистить симлинки
 */
export async function removeSymlinks(targetDir: string) {
  const entries = await fs.readdir(targetDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(targetDir, entry.name);

    try {
      const stat = await fs.lstat(fullPath);

      if (stat.isSymbolicLink()) {
        await fs.unlink(fullPath);
        logInfo(`Удалён симлинк: ${fullPath}`);
      }
    } catch (e) {
      logInfo(`Ошибка при обработке ${fullPath}: ${(e as Error)?.message}`);
    }
  }
}