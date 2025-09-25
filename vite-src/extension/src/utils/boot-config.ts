import fs from 'fs';
import path from 'path';
import { logError, logInfo } from './logger.js';

/**
 * Оптимизационные настройки для Valheim
 */
const OPTIMIZATION_SETTINGS = [
  'gfx-enable-gfx-jobs=1',
  'gfx-enable-native-gfx-jobs=1',
  'vr-enabled=0',
  'scripting-runtime-version=latest',
];

/**
 * Получает путь к файлу Boot.config для Valheim
 * @param valheimPath - путь к папке с игрой Valheim
 * @returns путь к файлу Boot.config или null если путь невалиден
 */
export const getBootConfigPath = (valheimPath: string): string | null => {
  if (!valheimPath) {
    return null;
  }

  return path.join(valheimPath, 'valheim_Data', 'Boot.config');
};

/**
 * Проверяет существование файла Boot.config
 * @param valheimPath - путь к папке с игрой Valheim
 * @returns true если файл существует, false в противном случае
 */
export const checkBootConfigExists = (valheimPath: string): boolean => {
  const bootConfigPath = getBootConfigPath(valheimPath);
  if (!bootConfigPath) {
    return false;
  }

  return fs.existsSync(bootConfigPath);
};

/**
 * Читает содержимое файла Boot.config
 * @param valheimPath - путь к папке с игрой Valheim
 * @returns содержимое файла или null если файл не найден
 */
export const readBootConfig = (valheimPath: string): string | null => {
  const bootConfigPath = getBootConfigPath(valheimPath);
  if (!bootConfigPath || !fs.existsSync(bootConfigPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(bootConfigPath, 'utf-8');
    logInfo(`[BootConfig] Read config from: ${bootConfigPath}`);
    return content;
  } catch (e) {
    logError(`[BootConfig] Error reading config: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
};

/**
 * Записывает содержимое в файл Boot.config
 * @param valheimPath - путь к папке с игрой Valheim
 * @param content - содержимое для записи
 * @returns true если запись успешна, false в противном случае
 */
export const writeBootConfig = (valheimPath: string, content: string): boolean => {
  const bootConfigPath = getBootConfigPath(valheimPath);
  if (!bootConfigPath) {
    return false;
  }

  try {
    // Создаем папку valheim_Data если она не существует
    const valheimDataPath = path.dirname(bootConfigPath);
    if (!fs.existsSync(valheimDataPath)) {
      fs.mkdirSync(valheimDataPath, { recursive: true });
      logInfo(`[BootConfig] Created directory: ${valheimDataPath}`);
    }

    fs.writeFileSync(bootConfigPath, content, 'utf-8');
    logInfo(`[BootConfig] Written config to: ${bootConfigPath}`);
    return true;
  } catch (e) {
    logError(`[BootConfig] Error writing config: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
};

/**
 * Добавляет оптимизационные настройки в Boot.config
 * Проверяет наличие строк и добавляет только недостающие
 * @param valheimPath - путь к папке с игрой Valheim
 */
export const addOptimizationSettings = (valheimPath: string): void => {
  const currentContent = readBootConfig(valheimPath) || '';
  const lines = currentContent.split('\n');

  // Проверяем какие настройки уже есть
  const existingSettings = new Set<string>();
  const newLines: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine) {
      newLines.push(line);

      // Проверяем есть ли уже эта настройка
      for (const setting of OPTIMIZATION_SETTINGS) {
        if (trimmedLine.startsWith(setting.split('=')[0] + '=')) {
          existingSettings.add(setting);
        }
      }
    }
  }

  // Добавляем недостающие настройки
  let settingsAdded = false;
  for (const setting of OPTIMIZATION_SETTINGS) {
    if (!existingSettings.has(setting)) {
      newLines.push(setting);
      settingsAdded = true;
      logInfo(`[BootConfig] Added setting: ${setting}`);
    }
  }

  if (settingsAdded) {
    const newContent = newLines.join('\n');
    writeBootConfig(valheimPath, newContent);
    logInfo(`[BootConfig] Optimization settings applied successfully`);
  } else {
    logInfo(`[BootConfig] All optimization settings already present`);
  }
};

/**
 * Удаляет оптимизационные настройки из Boot.config
 * @param valheimPath - путь к папке с игрой Valheim
 */
export const removeOptimizationSettings = (valheimPath: string): void => {
  const currentContent = readBootConfig(valheimPath);
  if (!currentContent) {
    logInfo(`[BootConfig] File does not exist, optimization settings already removed`);
    return;
  }

  const lines = currentContent.split('\n');
  const newLines: string[] = [];
  let settingsRemoved = false;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine) {
      // Проверяем не является ли эта строка оптимизационной настройкой
      let isOptimizationSetting = false;
      for (const setting of OPTIMIZATION_SETTINGS) {
        if (trimmedLine.startsWith(setting.split('=')[0] + '=')) {
          isOptimizationSetting = true;
          settingsRemoved = true;
          logInfo(`[BootConfig] Removed setting: ${trimmedLine}`);
          break;
        }
      }

      if (!isOptimizationSetting) {
        newLines.push(line);
      }
    }
  }

  if (settingsRemoved) {
    const newContent = newLines.join('\n');
    writeBootConfig(valheimPath, newContent);
    logInfo(`[BootConfig] Optimization settings removed successfully`);
  } else {
    logInfo(`[BootConfig] No optimization settings found to remove`);
  }
};
