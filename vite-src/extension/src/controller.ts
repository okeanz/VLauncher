export class Controller {
  private busy = false;
  private readyPath = '';
  private aborter?: AbortController;
  private pending?: Promise<void>;
  private stopping = false;
  constructor(
    private deps: {
      install: (game: string, signal: AbortSignal) => Promise<unknown>;
      running: () => Promise<boolean>;
      launch: (game: string) => Promise<void>;
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
        this.readyPath = '';
        this.deps.notify('operationError', {
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        this.busy = false;
      }
    })();
    await this.pending;
  }
  async update(game: string) {
    await this.run(async () => {
      this.readyPath = '';
      this.aborter = new AbortController();
      this.deps.notify('installStarted', { gamePath: game });
      if (await this.deps.running()) throw new Error('Закройте Valheim перед обновлением');
      await this.deps.install(game, this.aborter.signal);
      this.aborter.signal.throwIfAborted();
      this.readyPath = game;
      this.deps.notify('installReady', { gamePath: game });
    });
  }
  async launch(game: string) {
    await this.run(async () => {
      if (!this.readyPath || game !== this.readyPath)
        throw new Error('Сначала завершите установку модпака');
      if (await this.deps.running()) throw new Error('Valheim уже запущен');
      await this.deps.launch(game);
      this.deps.notify('gameState', { running: true });
    });
  }
  async configure(action: () => Promise<void>) {
    await this.run(async () => {
      if (await this.deps.running()) throw new Error('Закройте Valheim перед изменением настроек');
      await action();
    });
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
