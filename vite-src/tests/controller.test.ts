import { describe, it, expect, vi } from 'vitest';
import { Controller } from '../extension/src/controller';
function fixture() {
  const deps = {
    install: vi.fn(async (_game: string, _signal: AbortSignal) => {}),
    running: vi.fn(async () => false),
    launch: vi.fn(async (_game: string) => {}),
    notify: vi.fn(),
  };
  return { deps, controller: new Controller(deps) };
}
describe('operation controller', () => {
  it('does not launch before successful installation', async () => {
    const { deps, controller } = fixture();
    await controller.launch('game');
    expect(deps.launch).not.toHaveBeenCalled();
    expect(deps.notify).toHaveBeenCalledWith('operationError', expect.anything());
  });
  it('launches only the installed path', async () => {
    const { deps, controller } = fixture();
    await controller.update('one');
    await controller.launch('two');
    expect(deps.launch).not.toHaveBeenCalled();
    await controller.update('one');
    await controller.launch('one');
    expect(deps.launch).toHaveBeenCalledWith('one');
  });
  it('invalidates readiness when updating fails', async () => {
    const { deps, controller } = fixture();
    await controller.update('game');
    deps.install.mockRejectedValueOnce(new Error('network'));
    await controller.update('game');
    await controller.launch('game');
    expect(deps.launch).not.toHaveBeenCalled();
    expect(controller.active).toBe(false);
  });
  it('blocks installation while Valheim runs', async () => {
    const { deps, controller } = fixture();
    deps.running.mockResolvedValue(true);
    await controller.update('game');
    expect(deps.install).not.toHaveBeenCalled();
  });
  it('blocks a second launch of a running game', async () => {
    const { deps, controller } = fixture();
    await controller.update('game');
    deps.running.mockResolvedValue(true);
    await controller.launch('game');
    expect(deps.launch).not.toHaveBeenCalled();
  });
  it('fails closed if process detection fails', async () => {
    const { deps, controller } = fixture();
    deps.running.mockRejectedValue(new Error('tasklist failed'));
    await controller.update('game');
    expect(deps.install).not.toHaveBeenCalled();
  });
  it('serializes update, launch and configuration', async () => {
    const { deps, controller } = fixture();
    let finish!: () => void;
    deps.install.mockImplementationOnce(
      () =>
        new Promise<void>((r) => {
          finish = r;
        }),
    );
    const pending = controller.update('game');
    await vi.waitFor(() => expect(deps.install).toHaveBeenCalled());
    await expect(controller.update('other')).rejects.toThrow();
    await expect(controller.launch('game')).rejects.toThrow();
    await expect(controller.configure(async () => {})).rejects.toThrow();
    expect(deps.install).toHaveBeenCalledTimes(1);
    finish();
    await pending;
    expect(controller.active).toBe(false);
  });
  it('waits for cancellation and rollback before shutdown completes', async () => {
    const { deps, controller } = fixture();
    let rollback!: () => void;
    deps.install.mockImplementationOnce(
      (_game, signal) =>
        new Promise<void>((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            rollback = () => reject(new Error('cancelled'));
          });
        }),
    );
    const pending = controller.update('game');
    await vi.waitFor(() => expect(deps.install).toHaveBeenCalled());
    let stopped = false;
    const stop = controller.stop().then(() => {
      stopped = true;
    });
    await Promise.resolve();
    expect(stopped).toBe(false);
    rollback();
    await stop;
    await pending;
    expect(deps.notify).not.toHaveBeenCalledWith('installReady', expect.anything());
    await expect(controller.update('game')).rejects.toThrow();
  });
  it('tracks configuration during shutdown and prevents concurrent updates', async () => {
    const { controller } = fixture();
    let finish!: () => void;
    const action = vi.fn(
      () =>
        new Promise<void>((r) => {
          finish = r;
        }),
    );
    const pending = controller.configure(action);
    await vi.waitFor(() => expect(action).toHaveBeenCalled());
    await expect(controller.update('game')).rejects.toThrow();
    let stopped = false;
    const stop = controller.stop().then(() => {
      stopped = true;
    });
    await Promise.resolve();
    expect(stopped).toBe(false);
    finish();
    await pending;
    await stop;
    expect(stopped).toBe(true);
  });
  it('propagates launch errors and unlocks controls', async () => {
    const { deps, controller } = fixture();
    await controller.update('game');
    deps.launch.mockRejectedValue(new Error('permission'));
    await controller.launch('game');
    expect(controller.active).toBe(false);
    expect(deps.notify).toHaveBeenCalledWith('operationError', { error: 'permission' });
  });
});
