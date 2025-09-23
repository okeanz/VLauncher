/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_GLOBAL_URL: string;
    readonly VITE_API_URL: string;
    // можно добавлять другие переменные
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
