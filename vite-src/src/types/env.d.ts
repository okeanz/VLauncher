/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GLOBAL_URL: string;
  readonly VITE_API_URL: string;
  /** dev: admin build through the tunnel; prod: player build, main server only. */
  readonly VITE_PROFILE?: 'dev' | 'prod';
  /** '1' shows the server menu (admin builds). */
  readonly VITE_SERVER_PICKER?: string;
  // можно добавлять другие переменные
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
