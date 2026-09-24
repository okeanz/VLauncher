// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MantineProvider } from '@mantine/core';
const native = vi.hoisted(() => ({
  dispatch: vi.fn(async () => {}),
  dialog: vi.fn(async () => ''),
  getStats: vi.fn(async () => ({ isFile: true })),
  setData: vi.fn(async () => {}),
  execCommand: vi.fn(),
}));
vi.mock('@neutralinojs/lib', () => ({
  extensions: { dispatch: native.dispatch },
  os: { showFolderDialog: native.dialog, execCommand: native.execCommand },
  filesystem: { getStats: native.getStats },
  storage: { setData: native.setData },
  debug: { log: vi.fn() },
}));
import { store } from '../src/shared/store';
import { ValheimLaunch } from '../src/components/valheim-launch';
import { ValheimPath } from '../src/components/valheim-path';
import { ValheimOptimization } from '../src/components/valheim-optimization';
import { LoadingBar } from '../src/components/loading-bar';
import { ServerSelect } from '../src/components/server-select';
import { VoyageBar } from '../src/components/voyage-bar';
import {
  updateProgress,
  beginInstall,
  installReady,
  resetProgress,
  setConnected,
  setRunning,
  setError,
  setConfiguring,
  setServerRelease,
  setServers,
  selectServer,
} from '../src/features/progress/progress.slice';
import { setValheimPath } from '../src/features/settings/settings.actions';
import { setOptimizationConfirmed } from '../src/features/settings/settings.slice';
function ui() {
  return render(
    <Provider store={store}>
      <MantineProvider>
        <ValheimPath />
        <ValheimLaunch />
        <LoadingBar />
        <ValheimOptimization />
      </MantineProvider>
    </Provider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  native.dispatch.mockResolvedValue();
  native.execCommand.mockRejectedValue(new Error('not checked in this test'));
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
  // Mantine's combobox scrolls the active option into view; jsdom has no layout.
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  store.dispatch(resetProgress());
  store.dispatch(setConnected(true));
  store.dispatch(
    setServerRelease({
      releaseId: 'localmods-1-0-12-r8',
      title: 'Starblood Ascension 0.1.0',
      gameVersion: '1.0.12',
      createdAt: null,
      activatedAt: null,
    }),
  );
  store.dispatch(setValheimPath.fulfilled({ path: 'C:/Game', isValid: true }, 'test', 'C:/Game'));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('shows an unverified modpack and disables launch initially', () => {
  ui();
  expect(
    (screen.getByRole('button', { name: 'Запустить Valheim' }) as HTMLButtonElement).disabled,
  ).toBe(true);
  expect(screen.getByText('Модпак ещё не проверен')).toBeTruthy();
});
it('enables launch only after complete installation and dispatches to the extension', async () => {
  store.dispatch(beginInstall('C:/Game'));
  store.dispatch(installReady('C:/Game', 'localmods-1-0-12-r8'));
  ui();
  const button = screen.getByRole('button', { name: 'Запустить Valheim' });
  expect((button as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(button);
  await waitFor(() =>
    expect(native.dispatch).toHaveBeenCalledWith('fileLoader', 'LaunchGame', {
      valheimPath: 'C:/Game',
      serverId: 'main',
    }),
  );
  expect((button as HTMLButtonElement).disabled).toBe(true);
});
it('offers to start Steam instead of launching a game that would hang without it', async () => {
  let signedIn = false;
  native.execCommand.mockImplementation(async (command: string) => {
    if (command.includes('ActiveUser'))
      return { stdOut: `    ActiveUser    REG_DWORD    ${signedIn ? '0x1' : '0x0'}` };
    if (command.includes('SteamExe'))
      return { stdOut: '    SteamExe    REG_SZ    c:/steam/steam.exe' };
    if (command.startsWith('tasklist')) return { stdOut: 'steam.exe' };
    signedIn = true;
    return { stdOut: '' };
  });
  store.dispatch(beginInstall('C:/Game'));
  store.dispatch(installReady('C:/Game', 'localmods-1-0-12-r8'));
  ui();
  fireEvent.click(screen.getByRole('button', { name: 'Запустить Valheim' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Запустить Steam' }));
  expect(native.dispatch).not.toHaveBeenCalled();
  await waitFor(() =>
    expect(native.execCommand).toHaveBeenCalledWith('"c:\\steam\\steam.exe"', { background: true }),
  );
  await waitFor(() =>
    expect(native.dispatch).toHaveBeenCalledWith('fileLoader', 'LaunchGame', {
      valheimPath: 'C:/Game',
      serverId: 'main',
    }),
  );
});
it('disables folder selection, optimization and retry while updating', () => {
  store.dispatch(beginInstall('C:/Game'));
  ui();
  for (const name of ['Обзор', 'Проверить обновления'])
    expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole('switch') as HTMLInputElement).disabled).toBe(true);
});
it('shows an error and allows retry without falsely enabling launch', async () => {
  store.dispatch(setError('Повреждён архив'));
  ui();
  expect(screen.getByText('Повреждён архив')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Проверить обновления' }));
  await waitFor(() =>
    expect(native.dispatch).toHaveBeenCalledWith('fileLoader', 'LoadFiles', {
      valheimPath: 'C:/Game',
      serverId: 'main',
    }),
  );
  expect(
    (screen.getByRole('button', { name: 'Установка модпака...' }) as HTMLButtonElement).disabled,
  ).toBe(true);
});
it('locks update and path selection when the game runs', () => {
  store.dispatch(setRunning(true));
  ui();
  expect(
    (screen.getByRole('button', { name: 'Игра запущена' }) as HTMLButtonElement).disabled,
  ).toBe(true);
  expect((screen.getByRole('button', { name: 'Обзор' }) as HTMLButtonElement).disabled).toBe(true);
});
it('does not change the saved path when folder selection is cancelled', async () => {
  native.dialog.mockResolvedValueOnce('');
  ui();
  fireEvent.click(screen.getByRole('button', { name: 'Обзор' }));
  await waitFor(() => expect(native.dialog).toHaveBeenCalled());
  expect(store.getState().settings.valheimPath).toBe('C:/Game');
  expect(native.setData).not.toHaveBeenCalled();
});
it('waits for acknowledgement before showing optimization as enabled', async () => {
  ui();
  const checkbox = screen.getByRole('switch') as HTMLInputElement;
  fireEvent.click(checkbox);
  await waitFor(() =>
    expect(native.dispatch).toHaveBeenCalledWith('fileLoader', 'EnableValheimOptimization', {
      valheimPath: 'C:/Game',
    }),
  );
  expect(checkbox.checked).toBe(false);
  expect(checkbox.disabled).toBe(true);
  store.dispatch(setOptimizationConfirmed(true));
  store.dispatch(setConfiguring(false));
  await waitFor(() => expect(checkbox.checked).toBe(true));
});
it('offers test servers in the server menu and switches to the chosen one', async () => {
  const test = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  store.dispatch(
    setServers([
      {
        id: 'main',
        kind: 'main',
        name: 'Kuberheim',
        address: null,
        running: true,
        releaseId: 'r8',
      },
      {
        id: test,
        kind: 'test',
        name: 'Проверка r9',
        address: null,
        running: false,
        releaseId: null,
      },
    ]),
  );
  render(
    <Provider store={store}>
      <MantineProvider>
        <ServerSelect />
        <ValheimLaunch />
      </MantineProvider>
    </Provider>,
  );
  expect(screen.getByRole('img', { name: 'Сервер готов' })).toBeTruthy();
  fireEvent.click(screen.getByRole('textbox', { name: 'Сервер' }));
  expect(await screen.findByText('Kuberheim · localmods r8')).toBeTruthy();
  fireEvent.click(await screen.findByText('Проверка r9 · тест · остановлен · без модпака'));
  await waitFor(() => expect(store.getState().progress.selectedServer).toBe(test));
  await waitFor(() =>
    expect(native.dispatch).toHaveBeenCalledWith('fileLoader', 'LoadFiles', {
      valheimPath: 'C:/Game',
      serverId: test,
    }),
  );
  store.dispatch(setError('stop'));
  expect(await screen.findByRole('button', { name: 'Сервер остановлен' })).toBeTruthy();
  expect(screen.getByRole('img', { name: 'Сервер остановлен' })).toBeTruthy();
  store.dispatch(
    setServers([
      {
        id: test,
        kind: 'test',
        name: 'Проверка r9',
        address: null,
        running: true,
        state: 'starting',
        releaseId: 'r9',
      },
    ]),
  );
  expect(await screen.findByRole('button', { name: 'Сервер запускается…' })).toBeTruthy();
  expect(screen.getByRole('img', { name: 'Сервер запускается' })).toBeTruthy();
  store.dispatch(setServers(null));
  store.dispatch(selectServer('main'));
});
it('sails the drakkar to the reported install percent', () => {
  store.dispatch(beginInstall('C:/Game'));
  render(
    <Provider store={store}>
      <MantineProvider>
        <VoyageBar />
        <LoadingBar />
      </MantineProvider>
    </Provider>,
  );
  const bar = screen.getByRole('progressbar', { name: 'Установка модпака' });
  expect(bar.getAttribute('aria-valuenow')).toBeNull();
  act(() => {
    store.dispatch(updateProgress('Скачивание plugins', 44));
  });
  expect(bar.getAttribute('aria-valuenow')).toBe('44');
  expect(screen.getByText('44%')).toBeTruthy();
  expect(screen.getByText('Скачивание plugins')).toBeTruthy();
  expect(screen.getByText('Ставим localmods-1-0-12-r8')).toBeTruthy();
  act(() => {
    store.dispatch(installReady('C:/Game', 'localmods-1-0-12-r8'));
  });
  expect(screen.queryByRole('progressbar')).toBeNull();
  expect(screen.getByText('Совпадает с сервером')).toBeTruthy();
});
it('asks for the game folder when none is found', () => {
  store.dispatch(setValheimPath.fulfilled({ path: '', isValid: false }, 'test', ''));
  ui();
  expect(screen.getByText('Не найдена папка с установленным Valheim')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Указать папку Valheim' }));
  expect(native.dialog).toHaveBeenCalled();
  expect(
    (screen.getByRole('button', { name: 'Укажите папку Valheim' }) as HTMLButtonElement).disabled,
  ).toBe(true);
});
it('shows optimization transport failures and releases controls', async () => {
  native.dispatch.mockRejectedValueOnce(new Error('disconnected'));
  ui();
  fireEvent.click(screen.getByRole('switch'));
  await waitFor(() => expect(screen.getByText('Не удалось изменить настройки')).toBeTruthy());
  expect(store.getState().progress.configuring).toBe(false);
});
