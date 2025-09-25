import { logError, logInfo } from '../utils/logger.js';
import { 
  addOptimizationSettings, 
  removeOptimizationSettings, 
  checkBootConfigExists 
} from '../utils/boot-config.js';

/**
 * Включает оптимизацию Valheim
 * @param valheimPath - путь к папке с игрой Valheim
 */
export const enableValheimOptimization = async (valheimPath: string): Promise<void> => {
  try {
    logInfo(`[enableValheimOptimization] Enabling optimization for path: ${valheimPath}`);

    if (!valheimPath) {
      logError(`[enableValheimOptimization] Valheim path not provided`);
      return;
    }

    if (!checkBootConfigExists(valheimPath)) {
      logError(`[enableValheimOptimization] Boot.config file not found`);
      return;
    }

    addOptimizationSettings(valheimPath);
    logInfo(`[enableValheimOptimization] Optimization process completed`);
  } catch (e) {
    logError(`[enableValheimOptimization] Error: ${e instanceof Error ? e.message : String(e)}`);
  }
};

/**
 * Отключает оптимизацию Valheim
 * @param valheimPath - путь к папке с игрой Valheim
 */
export const disableValheimOptimization = async (valheimPath: string): Promise<void> => {
  try {
    logInfo(`[disableValheimOptimization] Disabling optimization for path: ${valheimPath}`);

    if (!valheimPath) {
      logError(`[disableValheimOptimization] Valheim path not provided`);
      return;
    }

    if (!checkBootConfigExists(valheimPath)) {
      logError(`[disableValheimOptimization] Boot.config file not found`);
      return;
    }

    removeOptimizationSettings(valheimPath);
    logInfo(`[disableValheimOptimization] Optimization process completed`);
  } catch (e) {
    logError(`[disableValheimOptimization] Error: ${e instanceof Error ? e.message : String(e)}`);
  }
};
