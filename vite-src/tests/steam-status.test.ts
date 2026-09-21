import { beforeEach, describe, expect, it, vi } from 'vitest';
const native = vi.hoisted(() => ({ execCommand: vi.fn(), log: vi.fn() }));
vi.mock('@neutralinojs/lib', () => ({
  os: { execCommand: native.execCommand },
  debug: { log: native.log },
}));
import { isSteamReady, startSteam, waitForSteam } from '../src/utils/steam-status';

const reg = (name: string, type: string, data: string) => ({
  stdOut: `\r\nHKEY_CURRENT_USER\Software\Valve\Steam\r\n    ${name}    ${type}    ${data}\r\n`,
});
const steam = (user: string, running: boolean) =>
  native.execCommand.mockImplementation(async (command: string) =>
    command.startsWith('reg query')
      ? reg('ActiveUser', 'REG_DWORD', user)
      : {
          stdOut: running ? 'steam.exe   1234 Console  1  90 000 K' : 'INFO: No tasks are running',
        },
  );
beforeEach(() => vi.clearAllMocks());

describe('steam status', () => {
  it('is ready when an account is signed in and the process exists', async () => {
    steam('0x4a5b6c7', true);
    expect(await isSteamReady()).toBe(true);
  });
  it('is not ready after Steam exits and zeroes the account', async () => {
    steam('0x0', false);
    expect(await isSteamReady()).toBe(false);
  });
  it('is not ready when a crash left the account id but no process', async () => {
    steam('0x4a5b6c7', false);
    expect(await isSteamReady()).toBe(false);
  });
  it('does not block the launch when the check cannot run', async () => {
    native.execCommand.mockRejectedValue(new Error('no reg'));
    expect(await isSteamReady()).toBe(true);
    native.execCommand.mockResolvedValue({ stdOut: '' });
    expect(await isSteamReady()).toBe(true);
  });
  it('starts the client from the registry path in the background', async () => {
    native.execCommand.mockResolvedValue(
      reg('SteamExe', 'REG_SZ', 'c:/program files (x86)/steam/steam.exe'),
    );
    await startSteam();
    expect(native.execCommand).toHaveBeenLastCalledWith(
      '"c:\\program files (x86)\\steam\\steam.exe"',
      { background: true },
    );
  });
  it('refuses to start a client it cannot find', async () => {
    native.execCommand.mockResolvedValue({ stdOut: '' });
    await expect(startSteam()).rejects.toThrow('Steam не найден');
  });
  it('waits until the account signs in, and gives up after the timeout', async () => {
    let calls = 0;
    native.execCommand.mockImplementation(async (command: string) =>
      command.startsWith('reg query')
        ? reg('ActiveUser', 'REG_DWORD', ++calls < 3 ? '0x0' : '0x1')
        : { stdOut: 'steam.exe' },
    );
    expect(await waitForSteam(1, 1000)).toBe(true);
    steam('0x0', false);
    expect(await waitForSteam(1, 20)).toBe(false);
  });
});
