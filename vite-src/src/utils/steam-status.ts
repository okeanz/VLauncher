import { os, debug } from '@neutralinojs/lib';

// Without a running Steam client valheim.exe fails SteamAPI_Init and hangs on the loading screen.
const value = async (key: string, name: string, type: string) => {
  const result = await os.execCommand(`reg query "${key}" /v ${name}`);
  return result.stdOut?.match(new RegExp(`${name}\\s+${type}\\s+(.+)`))?.[1].trim() ?? '';
};

// Steam keeps the signed-in account id in ActiveUser and zeroes it on exit. A crash leaves it stale,
// so the process has to be there too. A check that cannot run must not block the launch.
export async function isSteamReady(): Promise<boolean> {
  try {
    const user = await value(
      'HKCU\\Software\\Valve\\Steam\\ActiveProcess',
      'ActiveUser',
      'REG_DWORD',
    );
    if (!user) return true;
    if (parseInt(user, 16) === 0) return false;
    const tasks = await os.execCommand('tasklist /FI "IMAGENAME eq steam.exe" /NH');
    return /steam\.exe/i.test(tasks.stdOut ?? '');
  } catch (error) {
    debug.log(`Не удалось проверить Steam: ${JSON.stringify(error)}`);
    return true;
  }
}

export async function startSteam(): Promise<void> {
  const exe = await value('HKCU\\Software\\Valve\\Steam', 'SteamExe', 'REG_SZ');
  if (!exe) throw new Error('Steam не найден: запустите его вручную');
  await os.execCommand(`"${exe.replace(/\//g, '\\')}"`, { background: true });
}

export async function waitForSteam(intervalMs = 2000, timeoutMs = 120000): Promise<boolean> {
  for (const end = Date.now() + timeoutMs; Date.now() < end; ) {
    if (await isSteamReady()) return true;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return isSteamReady();
}
