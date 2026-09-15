// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MantineProvider } from '@mantine/core';
const native = vi.hoisted(() => ({
  dispatch: vi.fn(async () => {}),
  dialog: vi.fn(async () => ''),
  getStats: vi.fn(async () => ({ isFile: true })),
  setData: vi.fn(async () => {}),
}));
vi.mock('@neutralinojs/lib', () => ({
  extensions: { dispatch: native.dispatch },
  os: { showFolderDialog: native.dialog },
  filesystem: { getStats: native.getStats },
  storage: { setData: native.setData },
  debug: { log: vi.fn() },
}));
import { store } from '../src/shared/store';
import { ValheimLaunch } from '../src/components/valheim-launch';
import { ValheimPath } from '../src/components/valheim-path';
import { ValheimOptimization } from '../src/components/valheim-optimization';
import { LoadingBar } from '../src/components/loading-bar';
import {
  beginInstall,
  installReady,
  resetProgress,
  setConnected,
  setRunning,
  setError,
  setConfiguring,
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
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
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
  store.dispatch(installReady('C:/Game'));
  ui();
  const button = screen.getByRole('button', { name: 'Запустить Valheim' });
  expect((button as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(button);
  await waitFor(() =>
    expect(native.dispatch).toHaveBeenCalledWith('fileLoader', 'LaunchGame', {
      valheimPath: 'C:/Game',
    }),
  );
  expect((button as HTMLButtonElement).disabled).toBe(true);
});
it('disables folder selection, optimization and retry while updating', () => {
  store.dispatch(beginInstall('C:/Game'));
  ui();
  for (const name of ['Обзор', 'Проверить обновления'])
    expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(true);
});
it('shows an error and allows retry without falsely enabling launch', async () => {
  store.dispatch(setError('Повреждён архив'));
  ui();
  expect(screen.getByText('Повреждён архив')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Проверить обновления' }));
  await waitFor(() =>
    expect(native.dispatch).toHaveBeenCalledWith('fileLoader', 'LoadFiles', {
      valheimPath: 'C:/Game',
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
  const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
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
it('shows optimization transport failures and releases controls', async () => {
  native.dispatch.mockRejectedValueOnce(new Error('disconnected'));
  ui();
  fireEvent.click(screen.getByRole('checkbox'));
  await waitFor(() => expect(screen.getByText('Не удалось изменить настройки')).toBeTruthy());
  expect(store.getState().progress.configuring).toBe(false);
});
