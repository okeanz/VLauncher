import fs from 'fs';
import { lock as lockCb, unlock as unlockCb } from 'pidlockfile';

function lock(filename: string): Promise<void> {
  return new Promise((resolve, reject) => {
    lockCb(filename, (err) => (err ? reject(err) : resolve()));
  });
}

function unlock(filename: string): Promise<void> {
  return new Promise((resolve, reject) => {
    unlockCb(filename, (err) => (err ? reject(err) : resolve()));
  });
}

/**
 * Гарантирует один инстанс: если старый жив — завершает его и продолжает.
 */
export async function ensureSingleInstance(
  pidFile: string,
  externalCleanup: () => void,
): Promise<void> {
  try {
    console.log('locking');
    await lock(pidFile);
  } catch {

    const oldPid = parseInt(fs.readFileSync(pidFile, 'utf-8'));
    console.log('old process running', oldPid);
    if (!isNaN(oldPid)) {
      try {
        console.error(`Found running process`, oldPid);
        process.kill(oldPid, 'SIGTERM');
        await unlock(pidFile);
        await lock(pidFile);
      } catch (e) {
        // ESRCH/EPERM — игнорируем (битый PID или нет прав)
        console.error(`Cant kill`, e);
      }
    }
  }

  console.log(`Started instance: ${process.pid}`);

  // Идемпотентная синхронная очистка
  let cleaned = false;
  const cleanupSync = () => {
    if (cleaned) return;
    cleaned = true;
    try {
      fs.unlinkSync(pidFile);
      fs.rmSync(pidFile);
      externalCleanup();
    } catch {
      /* empty */
    } // ENOENT — ок
  };

  // Сигналы: чистим и выходим
  const stop = () => {
    console.log(`Received sigterm, cleaning up ...`);

    cleanupSync();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  process.on('SIGHUP', stop);

  // Аварийные случаи
  process.on('uncaughtException', (err) => {
    console.error(err);
    cleanupSync();
    process.exit(1);
  });
  process.on('unhandledRejection', (err) => {
    console.error(err);
    cleanupSync();
    process.exit(1);
  });

  // Финальный fallback (может сработать после сигналов — безопасно, т.к. идемпотентно)
  process.on('exit', () => {
    cleanupSync();
  });
}
