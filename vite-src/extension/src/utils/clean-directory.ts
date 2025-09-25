import fs from 'fs';
import path from 'path';
import { logError, logInfo } from './logger.js';

/**
 * Очищает указанную папку от всех файлов и подпапок
 * Если папка не существует, создает её
 * @param dirPath - путь к папке для очистки
 */
export const cleanDirectory = async (dirPath: string): Promise<void> => {
  try {
    logInfo(`[cleanDirectory] Cleaning directory: ${dirPath}`);
    
    if (!fs.existsSync(dirPath)) {
      logInfo(`[cleanDirectory] Directory does not exist, creating: ${dirPath}`);
      fs.mkdirSync(dirPath, { recursive: true });
      return;
    }

    const files = fs.readdirSync(dirPath);
    
    if (files.length === 0) {
      logInfo(`[cleanDirectory] Directory is already empty: ${dirPath}`);
      return;
    }
    
    let removedCount = 0;
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        // Удаляем папку рекурсивно
        fs.rmSync(filePath, { recursive: true, force: true });
        removedCount++;
      } else {
        // Удаляем файл
        fs.unlinkSync(filePath);
        removedCount++;
      }
    }
    
    logInfo(`[cleanDirectory] Removed ${removedCount} items from ${dirPath}`);
  } catch (e) {
    logError(`[cleanDirectory] Error cleaning directory ${dirPath}: ${e instanceof Error ? e.message : String(e)}`);
    throw e;
  }
};
