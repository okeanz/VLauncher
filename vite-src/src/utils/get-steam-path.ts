import { os, debug } from '@neutralinojs/lib';

export async function getSteamPath() {
  try {
    // Выполняем reg query
    const result = await os.execCommand('reg query "HKCU\\Software\\Valve\\Steam" /v SteamPath');

    if (result.stdOut) {
      // Выглядит строка обычно так:
      // "    SteamPath    REG_SZ    C:\Program Files (x86)\Steam"
      const match = result.stdOut.match(/SteamPath\s+REG_SZ\s+(.+)/);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return '';
  } catch (err) {
    debug.log(`Ошибка чтения реестра: ${JSON.stringify(err)}`);
    console.log(`Ошибка чтения реестра: ${JSON.stringify(err)}`);
    return '';
  }
}
