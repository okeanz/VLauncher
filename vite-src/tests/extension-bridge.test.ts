import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MessageEvent } from 'ws';
import { EventEmitter } from 'node:events';
const mocks = vi.hoisted(() => ({
  install: vi.fn(async () => {}),
  optimize: vi.fn(async () => {}),
  stat: vi.fn(async () => ({ isFile: (): boolean => true })),
  notify: vi.fn(),
  pong: vi.fn(),
  shutdown: vi.fn(async () => {}),
  spawn: vi.fn(),
  execFile: vi.fn(),
}));
vi.mock('../extension/src/updater', () => ({ installRelease: mocks.install }));
vi.mock('../extension/src/utils/boot-config', () => ({
  setOptimization: mocks.optimize,
  getOptimization: vi.fn(async () => false),
}));
vi.mock('../extension/src/ws-events/progress-events', () => ({ sendProgressEvent: mocks.notify }));
vi.mock('../extension/src/websocket/heartbeat', () => ({ receivedPong: mocks.pong }));
vi.mock('../extension/src/on-exit', () => ({ shutdown: mocks.shutdown }));
vi.mock('node:fs/promises', () => ({ default: { stat: mocks.stat } }));
vi.mock('node:child_process', () => ({ spawn: mocks.spawn, execFile: mocks.execFile }));
async function fixture() {
  vi.resetModules();
  const module = await import('../extension/src/message-handler');
  const send = (event: string, data: unknown = {}) =>
    module.messageHandler({ data: JSON.stringify({ event, data }) } as MessageEvent);
  return { ...module, send };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('VITE_API_URL', 'https://mods.example/');
  mocks.execFile.mockImplementation((_file, _args, _options, callback) =>
    callback(null, { stdout: '' }),
  );
  mocks.stat.mockResolvedValue({ isFile: () => true });
  mocks.install.mockResolvedValue();
  mocks.optimize.mockResolvedValue();
});
describe('extension commands', () => {
  it('handles handshake, heartbeat and graceful close', async () => {
    const { send } = await fixture();
    await send('Hello');
    expect(mocks.notify).toHaveBeenCalledWith('extensionReady', {});
    await send('pong');
    expect(mocks.pong).toHaveBeenCalled();
    await send('terminate');
    expect(mocks.shutdown).toHaveBeenCalled();
  });
  it('reports malformed messages without crashing', async () => {
    const { messageHandler, send } = await fixture();
    await messageHandler({ data: 'not json' } as MessageEvent);
    await send('LoadFiles', { valheimPath: 'relative' });
    expect(mocks.notify).toHaveBeenCalledWith('operationError', expect.anything());
    expect(mocks.install).not.toHaveBeenCalled();
  });
  it('ignores unrecognized commands', async () => {
    const { send } = await fixture();
    await send('DeleteEverything');
    expect(mocks.install).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });
  it('routes a valid installation to the transaction engine', async () => {
    const { send } = await fixture();
    await send('LoadFiles', { valheimPath: 'C:/Game' });
    expect(mocks.install).toHaveBeenCalledWith(
      'C:/Game',
      'https://mods.example/',
      expect.stringContaining('cache'),
      expect.any(AbortSignal),
      expect.any(Function),
    );
    expect(mocks.notify).toHaveBeenCalledWith('installReady', { gamePath: 'C:/Game' });
  });
  it('does not write into a folder without valheim.exe', async () => {
    const { send } = await fixture();
    mocks.stat.mockResolvedValue({ isFile: () => false });
    await send('LoadFiles', { valheimPath: 'C:/Game' });
    expect(mocks.install).not.toHaveBeenCalled();
    expect(mocks.notify).toHaveBeenCalledWith('operationError', expect.anything());
  });
  it('requires a configured update service', async () => {
    const { send } = await fixture();
    vi.stubEnv('VITE_API_URL', '');
    await send('LoadFiles', { valheimPath: 'C:/Game' });
    expect(mocks.install).not.toHaveBeenCalled();
  });
  it('detects Valheim processes and refuses updates', async () => {
    const { send, gameRunning } = await fixture();
    mocks.execFile.mockImplementation((_file, _args, _options, cb) =>
      cb(null, { stdout: '"valheim.exe","123","Console"' }),
    );
    expect(await gameRunning()).toBe(true);
    await send('LoadFiles', { valheimPath: 'C:/Game' });
    expect(mocks.install).not.toHaveBeenCalled();
  });
  it('spawns the exact exe path without a shell and reports exit', async () => {
    const { send, gameRunning } = await fixture();
    const child = Object.assign(new EventEmitter(), { unref: vi.fn() });
    mocks.spawn.mockImplementation(() => {
      queueMicrotask(() => child.emit('spawn'));
      return child;
    });
    await send('LoadFiles', { valheimPath: 'C:/Game & mods' });
    await send('LaunchGame', { valheimPath: 'C:/Game & mods' });
    expect(mocks.spawn).toHaveBeenCalledWith(
      expect.stringMatching(/Game & mods[\\/]valheim.exe$/),
      [],
      expect.objectContaining({ shell: false, cwd: 'C:/Game & mods', stdio: 'ignore' }),
    );
    expect(await gameRunning()).toBe(true);
    expect(child.unref).toHaveBeenCalled();
    child.emit('exit', 0);
    expect(mocks.notify).toHaveBeenCalledWith('gameState', { running: false });
    expect(await gameRunning()).toBe(false);
  });
  it('acknowledges optimization only after the filesystem operation succeeds', async () => {
    const { send } = await fixture();
    await send('EnableValheimOptimization', { valheimPath: 'C:/Game' });
    expect(mocks.optimize).toHaveBeenCalledWith('C:/Game', true);
    expect(mocks.notify).toHaveBeenCalledWith('optimizationReady', {
      enabled: true,
      gamePath: 'C:/Game',
    });
    mocks.notify.mockClear();
    mocks.optimize.mockRejectedValueOnce(new Error('denied'));
    await send('DisableValheimOptimization', { valheimPath: 'C:/Game' });
    expect(mocks.notify).not.toHaveBeenCalledWith('optimizationReady', expect.anything());
    expect(mocks.notify).toHaveBeenCalledWith('operationError', { error: 'denied' });
  });
});
