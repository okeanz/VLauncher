import Neutralino from '@neutralinojs/lib';
import { log } from '@/utils/log.ts';

export const getValheimPath = async (steamPath: string | null) => {
  if (!steamPath) {
    return null;
  }
  try {
    // Путь к файлу libraryfolders.vdf
    const vdfPath = steamPath.replace(/\//g, '\\') + '\\steamapps\\libraryfolders.vdf';

    // Проверяем, что файл существует
    const exists = await Neutralino.filesystem.readFile(vdfPath).catch((err) => console.log(err));
    if (!exists) {
      log(`Файл libraryfolders.vdf не найден:: ${vdfPath}`);
      console.error('Файл libraryfolders.vdf не найден:', vdfPath);
      return null;
    }

    // Читаем содержимое
    const vdfContent = await Neutralino.filesystem.readFile(vdfPath);

    // Вытаскиваем пути библиотек
    const libraryPaths = [...vdfContent.matchAll(/"path"\s+"([^"]+)"/g)].map((m) => m[1]);

    // Добавляем основной путь Steam
    libraryPaths.push(steamPath);

    // Проверяем каждую библиотеку
    for (const libPath of libraryPaths) {
      const manifestPath = `${libPath}\\steamapps\\appmanifest_892970.acf`;

      try {
        await Neutralino.filesystem.readFile(manifestPath);
        // Если файл существует, значит Valheim установлен тут
        const gamePath = `${libPath}\\steamapps\\common\\Valheim`;

        // Проверим саму папку игры
        await Neutralino.filesystem.readDirectory(gamePath);
        return gamePath;
      } catch {
        // просто идем дальше
      }
    }

    return null;
  } catch (err) {
    log(`Ошибка при поиске Valheim: ${(err as Error).message}`);
    return null;
  }
};
