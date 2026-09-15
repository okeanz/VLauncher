import { beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  heartbeat: vi.fn(),
  stop: vi.fn(),
  shutdown: vi.fn(async () => {}),
  message: vi.fn(),
  log: vi.fn(),
  construct: vi.fn(),
}));
vi.mock('../extension/src/utils/logger', () => ({ logInfo: mock.log, logError: mock.log }));
vi.mock('../extension/src/on-exit', () => ({ shutdown: mock.shutdown }));
vi.mock('../extension/src/message-handler', () => ({ messageHandler: mock.message }));
vi.mock('../extension/src/websocket/heartbeat', () => ({
  startHeartbeat: mock.heartbeat,
  stopHeartbeat: mock.stop,
}));
vi.mock('ws', () => ({
  default: class Socket {
    static OPEN = 1;
    readyState = 1;
    send = vi.fn();
    onopen?: () => void;
    onclose?: () => void;
    onerror?: () => void;
    constructor(url: string) {
      mock.construct(url);
    }
  },
}));
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});
it('connects to loopback with encoded connection parameters and sends authenticated progress', async () => {
  const {
    setupWs,
    client: initial,
    makeSend,
  } = await import('../extension/src/websocket/setup-ws');
  expect(initial).toBeUndefined();
  makeSend()({ early: true });
  setupWs({ NL_PORT: '1234', NL_EXTID: 'fileLoader', NL_TOKEN: 'secret-access', NL_CTOKEN: 'a&b' });
  const { client } = await import('../extension/src/websocket/setup-ws');
  expect(mock.construct).toHaveBeenCalledWith(
    'ws://127.0.0.1:1234?extensionId=fileLoader&connectToken=a%26b',
  );
  client.onopen!({} as never);
  expect(mock.heartbeat).toHaveBeenCalledWith(client);
  const { sendProgressEvent } = await import('../extension/src/ws-events/progress-events');
  sendProgressEvent('installReady', { gamePath: 'game' });
  const raw = vi.mocked(client.send).mock.calls.at(-1)![0] as string;
  const data = JSON.parse(raw);
  expect(data.accessToken).toBe('secret-access');
  expect(data.data).toEqual({
    event: 'extensionToApp',
    data: { event: 'installReady', data: { gamePath: 'game' } },
  });
  expect(JSON.stringify(mock.log.mock.calls)).not.toContain('secret-access');
  expect(JSON.stringify(mock.log.mock.calls)).not.toContain('a&b');
});
it('requests graceful shutdown on close and socket failure', async () => {
  const m = await import('../extension/src/websocket/setup-ws');
  m.setupWs({ NL_PORT: '1', NL_EXTID: 'fileLoader', NL_TOKEN: 'a', NL_CTOKEN: 'b' });
  m.client.onclose!({} as never);
  m.client.onerror!({ message: 'contains secret token' } as never);
  expect(mock.stop).toHaveBeenCalledTimes(2);
  expect(mock.shutdown).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(mock.log.mock.calls)).not.toContain('secret token');
});
it('ignores sends to closed sockets', async () => {
  const m = await import('../extension/src/websocket/setup-ws');
  m.setupWs({ NL_PORT: '1', NL_EXTID: 'fileLoader', NL_TOKEN: 'a', NL_CTOKEN: 'b' });
  Object.assign(m.client, { readyState: 3 });
  m.makeSend()({ event: 'test' });
  expect(m.client.send).not.toHaveBeenCalled();
});
it('handles constructor failures without exposing connection tokens', async () => {
  mock.construct.mockImplementationOnce(() => {
    throw new Error('secret URL');
  });
  const m = await import('../extension/src/websocket/setup-ws');
  m.setupWs({ NL_PORT: '1', NL_EXTID: 'fileLoader', NL_TOKEN: 'a', NL_CTOKEN: 'b' });
  expect(mock.shutdown).toHaveBeenCalledWith(1);
  expect(JSON.stringify(mock.log.mock.calls)).not.toContain('secret URL');
});
