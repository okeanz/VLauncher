import { afterEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  stop: vi.fn(async () => {}),
  stopHeartbeat: vi.fn(),
  close: vi.fn(),
  send: vi.fn(),
  destroy: vi.fn(),
}));
vi.mock('../extension/src/message-handler', () => ({ controller: { stop: mock.stop } }));
vi.mock('../extension/src/websocket/heartbeat', () => ({ stopHeartbeat: mock.stopHeartbeat }));
vi.mock('../extension/src/websocket/setup-ws', () => ({
  client: { close: mock.close },
  makeSend: () => mock.send,
}));
afterEach(() => {
  process.exitCode = 0;
  vi.restoreAllMocks();
});
describe('shutdown', () => {
  it('waits for rollback, releases the instance once and acknowledges before closing', async () => {
    vi.resetModules();
    vi.clearAllMocks();
    const order: string[] = [];
    let finish!: () => void;
    mock.stop.mockImplementation(
      () =>
        new Promise<void>((r) => {
          finish = r;
        }),
    );
    mock.close.mockImplementation(() => {
      order.push('close');
    });
    mock.send.mockImplementation(() => {
      order.push('ack');
    });
    vi.spyOn(process.stdin, 'destroy').mockReturnValue(process.stdin);
    const { shutdown, setLockRelease } = await import('../extension/src/on-exit');
    const release = vi.fn(async () => {
      order.push('release');
    });
    setLockRelease(release);
    const first = shutdown(),
      second = shutdown();
    await Promise.resolve();
    expect(release).not.toHaveBeenCalled();
    finish();
    await Promise.all([first, second]);
    expect(mock.stop).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['release', 'ack', 'close']);
  });
  it('reports cleanup errors and still closes the transport', async () => {
    vi.resetModules();
    mock.stop.mockRejectedValueOnce(new Error('rollback failed'));
    vi.spyOn(process.stdin, 'destroy').mockReturnValue(process.stdin);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { shutdown } = await import('../extension/src/on-exit');
    await shutdown();
    expect(process.exitCode).toBe(1);
    expect(mock.close).toHaveBeenCalled();
  });
});
