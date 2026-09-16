import type { ReleaseInfo } from './updater.js';
export class Controller {
  private busy = false;
  private readyPath = '';
  private readyRelease = '';
  private readyServer = '';
  private aborter?: AbortController;
  private pending?: Promise<void>;
  private stopping = false;
  constructor(
    private deps: {
      install: (game: string, server: string, signal: AbortSignal) => Promise<ReleaseInfo>;
      currentRelease: (server: string) => Promise<ReleaseInfo>;
      running: () => Promise<boolean>;
      launch: (game: string, server: string) => Promise<void>;
      notify: (event: string, data: object) => void;
    },
  ) {}
  private async run(action: () => Promise<void>) {
    if (this.busy || this.stopping) throw new Error('Другая операция ещё выполняется');
    this.busy = true;
    this.pending = (async () => {
      try {
        await action();
      } catch (error) {
        this.forget();
        this.deps.notify('operationError', {
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        this.busy = false;
      }
    })();
    await this.pending;
  }
  private forget() {
    this.readyPath = '';
    this.readyRelease = '';
    this.readyServer = '';
  }
  async update(game: string, server = 'main') {
    await this.run(async () => {
      this.forget();
      this.aborter = new AbortController();
      this.deps.notify('installStarted', { gamePath: game, serverId: server });
      if (await this.deps.running()) throw new Error('Закройте Valheim перед обновлением');
      const release = await this.deps.install(game, server, this.aborter.signal);
      this.aborter.signal.throwIfAborted();
      this.readyPath = game;
      this.readyRelease = release.releaseId;
      this.readyServer = server;
      this.deps.notify('serverRelease', { serverId: server, release });
      this.deps.notify('installReady', {
        gamePath: game,
        releaseId: release.releaseId,
        serverId: server,
      });
    });
  }
  async launch(game: string, server = 'main') {
    await this.run(async () => {
      if (!this.readyPath || game !== this.readyPath || server !== this.readyServer)
        throw new Error('Сначала завершите установку модпака');
      if (await this.deps.running()) throw new Error('Valheim уже запущен');
      // The server may have rolled out a new revision since the last installation.
      const release = await this.deps.currentRelease(server).catch(() => {
        throw new Error('Не удалось проверить ревизию модпака на сервере');
      });
      this.deps.notify('serverRelease', { serverId: server, release });
      if (release.releaseId !== this.readyRelease) {
        this.forget();
        throw new Error(
          `На сервере новая ревизия модпака ${release.releaseId}, сначала обновите моды`,
        );
      }
      await this.deps.launch(game, server);
      this.deps.notify('gameState', { running: true });
    });
  }
  async configure(action: () => Promise<void>) {
    await this.run(async () => {
      if (await this.deps.running()) throw new Error('Закройте Valheim перед изменением настроек');
      await action();
    });
  }
  /** Read-only poll of the published revision; allowed alongside other operations. */
  async checkRelease(server = 'main') {
    if (this.stopping) return;
    try {
      const release = await this.deps.currentRelease(server);
      this.deps.notify('serverRelease', { serverId: server, release });
    } catch {
      this.deps.notify('serverRelease', { serverId: server, release: null });
    }
  }
  async stop() {
    this.stopping = true;
    this.aborter?.abort();
    await this.pending;
  }
  get active() {
    return this.busy;
  }
}
