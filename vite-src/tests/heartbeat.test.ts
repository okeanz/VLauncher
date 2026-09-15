import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type WS from 'ws';
const mock = vi.hoisted(() => ({ send: vi.fn(), shutdown: vi.fn(async () => {}) }));
vi.mock('../extension/src/websocket/setup-ws', () => ({ makeSend: () => mock.send }));
vi.mock('../extension/src/on-exit', () => ({ shutdown: mock.shutdown }));
import { startHeartbeat, stopHeartbeat, receivedPong } from '../extension/src/websocket/heartbeat';
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});
afterEach(() => {
  stopHeartbeat();
  vi.useRealTimers();
});
it('keeps an active connection alive with pongs', async () => {
  startHeartbeat({ readyState: 1, OPEN: 1 } as WS);
  for (let i = 0; i < 20; i++) {
    await vi.advanceTimersByTimeAsync(5000);
    receivedPong();
  }
  expect(mock.send).toHaveBeenCalledTimes(20);
  expect(mock.shutdown).not.toHaveBeenCalled();
});
it('shuts down after the frontend disappears', async () => {
  startHeartbeat({ readyState: 1, OPEN: 1 } as WS);
  await vi.advanceTimersByTimeAsync(35000);
  expect(mock.shutdown).toHaveBeenCalledWith(1);
});
it('does not send to a closed socket and clears old timers', async () => {
  startHeartbeat({ readyState: 3, OPEN: 1 } as WS);
  startHeartbeat({ readyState: 3, OPEN: 1 } as WS);
  expect(vi.getTimerCount()).toBe(1);
  await vi.advanceTimersByTimeAsync(5000);
  expect(mock.send).not.toHaveBeenCalled();
  stopHeartbeat();
  expect(vi.getTimerCount()).toBe(0);
});
