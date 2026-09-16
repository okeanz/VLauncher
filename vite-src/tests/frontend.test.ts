import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const native = vi.hoisted(() => ({
  dispatch: vi.fn(async () => {}),
  getData: vi.fn(async () => ''),
  setData: vi.fn(async () => {}),
  readFile: vi.fn(async () => ''),
  getStats: vi.fn(async (_file: string) => ({ isFile: false })),
  execCommand: vi.fn(async () => ({ stdOut: '' })),
  log: vi.fn(),
  killProcess: vi.fn(async () => {}),
  handlers: new Map<string, (event: { detail?: unknown }) => unknown>(),
}));
vi.mock('@neutralinojs/lib', () => ({
  extensions: { dispatch: native.dispatch },
  storage: { getData: native.getData, setData: native.setData },
  filesystem: { readFile: native.readFile, getStats: native.getStats },
  os: { execCommand: native.execCommand },
  debug: { log: native.log },
  app: { killProcess: native.killProcess },
  events: {
    on: vi.fn(async (name: string, handler: (event: { detail?: unknown }) => unknown) => {
      native.handlers.set(name, handler);
    }),
  },
}));
import {
  progressSlice,
  canLaunch,
  beginInstall,
  installReady,
  setError,
  clearError,
  setConnected,
  setRunning,
  setLaunching,
  setConfiguring,
  resetProgress,
  updateProgress,
  setServerRelease,
  releaseOutdated,
  setServers,
  selectServer,
  selectedServerInfo,
} from '../src/features/progress/progress.slice';
import { chooseServer } from '../src/shared/actions/choose-server';
import { getValheimPath } from '../src/utils/get-valheim-path';
import { findValheimPath } from '../src/utils/find-valheim-path';
import { store } from '../src/shared/store';
import { setValheimPath } from '../src/features/settings/settings.actions';
import { setOptimizationConfirmed } from '../src/features/settings/settings.slice';
import { loadArchives } from '../src/shared/actions/load-archives';
import { launchValheim } from '../src/utils/launch-valheim';
import { registerEvents } from '../src/events';
const r1 = {
  releaseId: 'r1',
  title: 'Test',
  gameVersion: null,
  createdAt: null,
  activatedAt: null,
};
const reduce = progressSlice.reducer;
const testId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const servers = [
  {
    id: 'main',
    kind: 'main' as const,
    name: 'Main',
    address: 'h:2456',
    running: true,
    releaseId: 'r1',
  },
  {
    id: testId,
    kind: 'test' as const,
    name: 'Test',
    address: 'h:2458',
    running: true,
    releaseId: 'r2',
  },
];
beforeEach(() => {
  vi.clearAllMocks();
  native.dispatch.mockResolvedValue();
  native.getStats.mockResolvedValue({ isFile: false });
  native.getData.mockResolvedValue('');
  native.readFile.mockResolvedValue('');
  native.execCommand.mockResolvedValue({ stdOut: '' });
  store.dispatch(resetProgress());
  store.dispatch(setConnected(true));
  store.dispatch(setServers(null));
  store.dispatch(selectServer('main'));
  store.dispatch(setServerRelease(r1));
});
afterEach(() => {
  vi.useRealTimers();
});
describe('launch state', () => {
  it('starts unready even with a reachable file server', () => {
    expect(canLaunch(reduce(undefined, { type: 'init' }), 'game')).toBe(false);
  });
  it('does not unlock between archive operations', () => {
    let s = reduce(reduce(undefined, setServerRelease(r1)), setConnected(true));
    s = reduce(s, beginInstall('game'));
    s = reduce(s, { type: 'progress/completeOperation' });
    expect(s.isLoading).toBe(true);
    expect(canLaunch(s, 'game')).toBe(false);
    s = reduce(s, installReady('game', 'r1'));
    expect(canLaunch(s, 'game')).toBe(true);
  });
  it('ignores readiness for a stale path', () => {
    const s = reduce(reduce(undefined, beginInstall('new')), installReady('old', 'r1'));
    expect(s.readyPath).toBe('');
    expect(s.isLoading).toBe(true);
  });
  it('clearing an error does not restore readiness', () => {
    let s = reduce(
      reduce(reduce(undefined, setConnected(true)), beginInstall('game')),
      installReady('game', 'r1'),
    );
    s = reduce(s, setServerRelease(r1));
    s = reduce(s, setError('failure'));
    s = reduce(s, clearError());
    expect(canLaunch(s, 'game')).toBe(false);
    s = reduce(s, installReady('game', 'r1'));
    expect(canLaunch(s, 'game')).toBe(false);
  });
  it.each([setRunning(true), setLaunching(true), setConfiguring(true), setConnected(false)])(
    'blocks launch for %j',
    (action) => {
      let s = reduce(
        reduce(reduce(undefined, setConnected(true)), beginInstall('game')),
        installReady('game', 'r1'),
      );
      s = reduce(reduce(s, setServerRelease(r1)), action);
      expect(canLaunch(s, 'game')).toBe(false);
    },
  );
  it('keeps readiness per server and blocks a stopped server', () => {
    let s = reduce(reduce(undefined, setConnected(true)), setServers(servers));
    s = reduce(s, selectServer(testId));
    s = reduce(s, setServerRelease({ ...r1, releaseId: 'r2' }));
    s = reduce(s, beginInstall('game'));
    s = reduce(s, installReady('game', 'r1', 'main'));
    expect(s.isLoading).toBe(false);
    expect(canLaunch(s, 'game')).toBe(false);
    s = reduce(s, beginInstall('game'));
    s = reduce(s, installReady('game', 'r2', testId));
    expect(canLaunch(s, 'game')).toBe(true);
    s = reduce(s, setServers([servers[0], { ...servers[1], running: false }]));
    expect(canLaunch(s, 'game')).toBe(false);
    s = reduce(s, setServers([{ ...servers[1], releaseId: null }]));
    expect(selectedServerInfo(s)?.releaseId).toBe('r2');
    s = reduce(s, selectServer('main'));
    expect(s.readyPath).toBe('');
    expect(s.serverRelease).toBeNull();
  });
  it('blocks launch until the installed revision matches the server', () => {
    let s = reduce(reduce(undefined, setConnected(true)), beginInstall('game'));
    s = reduce(s, installReady('game', 'r1'));
    expect(canLaunch(s, 'game')).toBe(false);
    s = reduce(s, setServerRelease(r1));
    expect(canLaunch(s, 'game')).toBe(true);
    s = reduce(s, setServerRelease({ ...r1, releaseId: 'r2' }));
    expect(releaseOutdated(s)).toBe(true);
    expect(canLaunch(s, 'game')).toBe(false);
    s = reduce(s, setServerRelease(null));
    expect(canLaunch(s, 'game')).toBe(false);
  });
  it('updates progress only during an installation', () => {
    expect(reduce(undefined, updateProgress('late')).currentFile).toBe('');
    expect(
      reduce(reduce(undefined, beginInstall('game')), updateProgress('downloading')).currentFile,
    ).toBe('downloading');
  });
});
describe('discovery', () => {
  it('continues to the second Steam library when the first has no game', async () => {
    native.readFile.mockResolvedValue('"path" "C:/Steam"\n"path" "D:/Library"');
    native.getStats.mockImplementation(async (file) => ({
      isFile: String(file).startsWith('D:/Library'),
    }));
    expect(await getValheimPath('C:/Steam')).toBe('D:/Library/steamapps/common/Valheim');
    expect(native.readFile).toHaveBeenCalledTimes(1);
  });
  it('checks the default library when libraryfolders.vdf is absent', async () => {
    native.readFile.mockRejectedValueOnce(new Error('missing'));
    native.getStats.mockResolvedValue({ isFile: true });
    expect(await getValheimPath('C:/Steam')).toBe('C:/Steam/steamapps/common/Valheim');
  });
  it('rejects folders without the executable', async () => {
    expect(await getValheimPath('C:/Steam')).toBe('');
    expect(await getValheimPath(null)).toBe('');
  });
  it('uses a valid saved path without probing Steam', async () => {
    native.getData.mockResolvedValue('D:/Saved');
    native.getStats.mockResolvedValue({ isFile: true });
    expect(await findValheimPath()).toBe('D:/Saved');
    expect(native.execCommand).not.toHaveBeenCalled();
  });
  it('ignores stale saved paths and searches Steam', async () => {
    native.getData.mockResolvedValue('X:/Gone');
    native.execCommand.mockResolvedValue({ stdOut: 'SteamPath    REG_SZ    C:/Steam' });
    native.getStats.mockImplementation(async (file) => ({
      isFile: String(file).startsWith('C:/Steam'),
    }));
    expect(await findValheimPath()).toBe('C:/Steam/steamapps/common/Valheim');
  });
  it('returns empty when both storage and registry are unavailable', async () => {
    native.getData.mockRejectedValueOnce(new Error('missing'));
    native.execCommand.mockRejectedValueOnce(new Error('missing'));
    expect(await findValheimPath()).toBe('');
  });
});
describe('frontend actions and bridge events', () => {
  it('blocks immediately when sending an installation request', async () => {
    await store.dispatch(loadArchives('C:/Game'));
    expect(store.getState().progress.isLoading).toBe(true);
    await store.dispatch(loadArchives('C:/Other'));
    expect(native.dispatch).toHaveBeenCalledTimes(1);
  });
  it('shows dispatch failures and keeps launch disabled', async () => {
    native.dispatch.mockRejectedValueOnce(new Error('offline'));
    await store.dispatch(loadArchives('C:/Game'));
    expect(store.getState().progress.error).toBeTruthy();
    expect(canLaunch(store.getState().progress, 'C:/Game')).toBe(false);
  });
  it('will not install while disconnected or running', async () => {
    store.dispatch(setConnected(false));
    await store.dispatch(loadArchives('game'));
    store.dispatch(setConnected(true));
    store.dispatch(setRunning(true));
    await store.dispatch(loadArchives('game'));
    expect(native.dispatch).not.toHaveBeenCalled();
  });
  it('validates and stores a selected path, then requests installation', async () => {
    native.getStats.mockResolvedValue({ isFile: true });
    await store.dispatch(setValheimPath('C:/Game'));
    expect(store.getState().settings.valheimPathValid).toBe(true);
    expect(native.setData).toHaveBeenCalled();
    expect(native.dispatch).toHaveBeenCalledWith('fileLoader', 'LoadFiles', {
      valheimPath: 'C:/Game',
      serverId: 'main',
    });
  });
  it('rejects invalid paths without updating storage or loading files', async () => {
    await store.dispatch(setValheimPath('C:/Missing'));
    expect(store.getState().settings.valheimPathValid).toBe(false);
    expect(native.setData).not.toHaveBeenCalled();
    expect(native.dispatch).not.toHaveBeenCalled();
  });
  it('reports storage errors and releases the path-selection lock', async () => {
    native.getStats.mockResolvedValue({ isFile: true });
    native.setData.mockRejectedValueOnce(new Error('storage failed'));
    await store.dispatch(setValheimPath('C:/Game'));
    expect(store.getState().settings.selecting).toBe(false);
    expect(store.getState().progress.error).toBe('Не удалось сохранить путь к игре');
    expect(native.dispatch).not.toHaveBeenCalled();
  });
  it('serializes asynchronous path validation', async () => {
    let finish!: (result: { isFile: boolean }) => void;
    native.getStats.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = store.dispatch(setValheimPath('C:/One'));
    await store.dispatch(setValheimPath('C:/Two'));
    expect(native.getStats).toHaveBeenCalledTimes(1);
    finish({ isFile: false });
    await pending;
    expect(store.getState().settings.valheimPath).toBe('C:/One');
  });
  it('does not let path changes bypass an active update', async () => {
    await store.dispatch(loadArchives('C:/Game'));
    await store.dispatch(setValheimPath('C:/Other'));
    expect(native.getStats).not.toHaveBeenCalled();
  });
  it('launches through the extension exactly once even on double click', async () => {
    store.dispatch(beginInstall('C:/Game & mods'));
    store.dispatch(installReady('C:/Game & mods', 'r1'));
    await Promise.all([launchValheim('C:/Game & mods'), launchValheim('C:/Game & mods')]);
    expect(native.dispatch).toHaveBeenCalledTimes(1);
    expect(native.dispatch).toHaveBeenCalledWith('fileLoader', 'LaunchGame', {
      valheimPath: 'C:/Game & mods',
      serverId: 'main',
    });
  });
  it('does not dispatch launch for the wrong path', async () => {
    store.dispatch(beginInstall('C:/Game'));
    store.dispatch(installReady('C:/Game', 'r1'));
    await launchValheim('other');
    expect(native.dispatch).not.toHaveBeenCalled();
  });
  it('shows a launch transport failure', async () => {
    store.dispatch(beginInstall('game'));
    store.dispatch(installReady('game', 'r1'));
    native.dispatch.mockRejectedValueOnce(new Error('offline'));
    await launchValheim('game');
    expect(store.getState().progress.launching).toBe(false);
    expect(store.getState().progress.error).toBeTruthy();
  });
  it('handles extension readiness, progress, errors, game exit and optimization acknowledgement', async () => {
    await store.dispatch(setValheimPath(''));
    await registerEvents();
    const emit = async (event: string, data: object = {}) =>
      native.handlers.get('extensionToApp')!({ detail: { event, data } });
    await emit('extensionReady');
    expect(store.getState().progress.connected).toBe(true);
    await emit('installStarted', { gamePath: 'game' });
    await emit('installProgress', { currentFile: 'plugins' });
    expect(store.getState().progress.currentFile).toBe('plugins');
    await emit('installReady', { gamePath: 'game', releaseId: 'r1' });
    expect(canLaunch(store.getState().progress, 'game')).toBe(true);
    await emit('gameState', { running: true });
    expect(store.getState().progress.running).toBe(true);
    await emit('gameState', { running: false });
    expect(store.getState().progress.running).toBe(false);
    store.dispatch(setConfiguring(true));
    await emit('optimizationReady', {
      gamePath: store.getState().settings.valheimPath,
      enabled: true,
    });
    expect(store.getState().settings.valheimOptimization).toBe(true);
    expect(store.getState().progress.configuring).toBe(false);
    await emit('ping');
    expect(native.dispatch).toHaveBeenCalledWith('fileLoader', 'pong');
    await emit('operationError', { error: 'disk' });
    expect(store.getState().progress.error).toBe('disk');
    await native.handlers.get('extClientDisconnect')!({});
    expect(store.getState().progress.connected).toBe(false);
    store.dispatch(setOptimizationConfirmed(false));
  });
  it('updates once per new server revision and resumes after the game exits', async () => {
    store.dispatch(setValheimPath.fulfilled({ path: 'C:/Game', isValid: true }, 'test', 'C:/Game'));
    await registerEvents();
    const emit = async (event: string, data: object = {}) =>
      native.handlers.get('extensionToApp')!({ detail: { event, data } });
    const loads = () =>
      native.dispatch.mock.calls.filter((call: unknown[]) => call[1] === 'LoadFiles').length;
    store.dispatch(beginInstall('C:/Game'));
    store.dispatch(installReady('C:/Game', 'r1'));
    await emit('serverRelease', { release: r1 });
    expect(loads()).toBe(0);
    await emit('gameState', { running: true });
    await emit('serverRelease', { release: { ...r1, releaseId: 'r2' } });
    expect(loads()).toBe(0);
    expect(canLaunch(store.getState().progress, 'C:/Game')).toBe(false);
    await emit('gameState', { running: false });
    expect(loads()).toBe(1);
    await emit('operationError', { error: 'network' });
    await emit('serverRelease', { release: { ...r1, releaseId: 'r2' } });
    expect(loads()).toBe(1);
    await emit('serverRelease', { release: null });
    expect(store.getState().progress.serverRelease).toBeNull();
    store.dispatch(setValheimPath.fulfilled({ path: '', isValid: false }, 'test', ''));
  });
  it('switches servers, remembers the choice and installs that modpack', async () => {
    store.dispatch(setValheimPath.fulfilled({ path: 'C:/Game', isValid: true }, 'test', 'C:/Game'));
    store.dispatch(setServers(servers));
    await store.dispatch(chooseServer(testId));
    expect(native.setData).toHaveBeenCalledWith('serverId', testId);
    expect(native.dispatch).toHaveBeenCalledWith('fileLoader', 'SelectServer', {
      serverId: testId,
    });
    expect(native.dispatch).toHaveBeenCalledWith('fileLoader', 'LoadFiles', {
      valheimPath: 'C:/Game',
      serverId: testId,
    });
    await registerEvents();
    const emit = async (event: string, data: object = {}) =>
      native.handlers.get('extensionToApp')!({ detail: { event, data } });
    await emit('serverRelease', { serverId: 'main', release: r1 });
    expect(store.getState().progress.serverRelease).toBeNull();
    await emit('operationError', { error: 'stop loading' });
    // The test server was deleted: the launcher returns to the main server.
    await emit('serverList', { servers: [servers[0]] });
    await vi.waitFor(() => expect(store.getState().progress.selectedServer).toBe('main'));
    store.dispatch(setValheimPath.fulfilled({ path: '', isValid: false }, 'test', ''));
  });
  it('closes immediately when the extension is not connected', async () => {
    await registerEvents();
    store.dispatch(setConnected(false));
    await native.handlers.get('windowClose')!({});
    expect(native.dispatch).not.toHaveBeenCalledWith('fileLoader', 'terminate');
    expect(native.killProcess).toHaveBeenCalledTimes(1);
    store.dispatch(setConnected(true));
  });
  it('waits for extension shutdown acknowledgement before closing the native app', async () => {
    vi.useFakeTimers();
    await registerEvents();
    store.dispatch(setConnected(true));
    await native.handlers.get('windowClose')!({});
    expect(native.killProcess).not.toHaveBeenCalled();
    expect(native.dispatch).toHaveBeenCalledWith('fileLoader', 'terminate');
    await native.handlers.get('extensionToApp')!({
      detail: { event: 'shutdownComplete', data: {} },
    });
    expect(native.killProcess).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
