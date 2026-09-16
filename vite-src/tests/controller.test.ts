import { describe, it, expect, vi } from 'vitest';
import { Controller } from '../extension/src/controller';
const release = (releaseId: string) => ({
  releaseId,
  title: null,
  gameVersion: null,
  createdAt: null,
  activatedAt: null,
});
function fixture() {
  const deps = {
    install: vi.fn(async (_game: string, _server: string, _signal: AbortSignal) => release('r1')),
    currentRelease: vi.fn(async (_server: string) => release('r1')),
    running: vi.fn(async () => false),
    launch: vi.fn(async (_game: string, _server: string) => {}),
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
    expect(deps.launch).toHaveBeenCalledWith('one', 'main');
  });
  it('refuses to launch a revision the server has replaced', async () => {
    const { deps, controller } = fixture();
    await controller.update('game');
    expect(deps.notify).toHaveBeenCalledWith('installReady', {
      gamePath: 'game',
      releaseId: 'r1',
      serverId: 'main',
    });
    deps.currentRelease.mockResolvedValue(release('r2'));
    await controller.launch('game');
    expect(deps.launch).not.toHaveBeenCalled();
    expect(deps.notify).toHaveBeenCalledWith('serverRelease', {
      serverId: 'main',
      release: release('r2'),
    });
    deps.install.mockResolvedValue(release('r2'));
    await controller.launch('game');
    expect(deps.launch).not.toHaveBeenCalled();
    await controller.update('game');
    await controller.launch('game');
    expect(deps.launch).toHaveBeenCalledWith('game', 'main');
  });
  it('launches only for the server whose modpack was installed', async () => {
    const test = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const { deps, controller } = fixture();
    await controller.update('game', test);
    expect(deps.install).toHaveBeenCalledWith('game', test, expect.any(AbortSignal));
    await controller.launch('game', 'main');
    expect(deps.launch).not.toHaveBeenCalled();
    await controller.update('game', test);
    await controller.launch('game', test);
    expect(deps.currentRelease).toHaveBeenCalledWith(test);
    expect(deps.launch).toHaveBeenCalledWith('game', test);
  });
  it('fails closed when the server revision cannot be read at launch', async () => {
    const { deps, controller } = fixture();
    await controller.update('game');
    deps.currentRelease.mockRejectedValue(new Error('offline'));
    await controller.launch('game');
    expect(deps.launch).not.toHaveBeenCalled();
    expect(deps.notify).toHaveBeenCalledWith('operationError', {
      error: 'Не удалось проверить ревизию модпака на сервере',
    });
  });
  it('reports the published revision or its absence', async () => {
    const { deps, controller } = fixture();
    await controller.checkRelease();
    expect(deps.notify).toHaveBeenLastCalledWith('serverRelease', {
      serverId: 'main',
      release: release('r1'),
    });
    deps.currentRelease.mockRejectedValue(new Error('offline'));
    await controller.checkRelease();
    expect(deps.notify).toHaveBeenLastCalledWith('serverRelease', {
      serverId: 'main',
      release: null,
    });
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
        new Promise((r) => {
          finish = () => r(release('r1'));
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
      (_game, _server, signal) =>
        new Promise((_resolve, reject) => {
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
