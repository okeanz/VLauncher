/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GLOBAL_URL: string;
  readonly VITE_API_URL: string;
  /** '1' shows the server menu (admin builds). */
  readonly VITE_SERVER_PICKER?: string;
  // можно добавлять другие переменные
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
