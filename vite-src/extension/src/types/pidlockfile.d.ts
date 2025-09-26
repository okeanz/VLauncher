declare module "pidlockfile" {
    /**
     * Коллбэк для асинхронных методов.
     * @param err Ошибка (если есть)
     * @param result Результат (boolean для check, void для остальных)
     */
    export type Callback<T = void> = (err: NodeJS.ErrnoException | null, result?: T) => void;

    /**
     * Проверяет, существует ли процесс из PID-файла.
     * true → процесс жив, false → процесс мёртв.
     */
    export function check(filename: string, callback: Callback<boolean>): void;

    /**
     * Создаёт PID-файл.
     * Если процесс уже существует → вернёт ошибку "Lockfile already acquired".
     * Если файл битый/мертвый → перезапишет.
     */
    export function lock(filename: string, callback: Callback<void>): void;

    /**
     * Удаляет PID-файл, тем самым освобождая лок.
     */
    export function unlock(filename: string, callback: Callback<void>): void;
}
