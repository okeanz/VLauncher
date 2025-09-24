import { logInfo } from '@/utils/logInfo.ts';
import Neutralino from '@neutralinojs/lib';

export async function launchValheim(gamePath: string) {
  try {
    // путь до exe-файла
    const exePath = gamePath.replace(/\\/g, '\\\\') + '\\\\valheim.exe';

    // запускаем процесс
    const proc = await Neutralino.os.spawnProcess(exePath);
    logInfo(`Valheim запущен. PID: ${proc.id}`);
    return proc.id;
  } catch (err) {
    logInfo(`Ошибка запуска Valheim: ${(err as Error).message}`);
    return null;
  }
}
