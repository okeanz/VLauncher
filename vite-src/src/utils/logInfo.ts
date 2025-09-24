import { debug } from '@neutralinojs/lib';
import { isPlainObject } from '@reduxjs/toolkit';

export const logInfo = (text: string | null | undefined | object) => {
  if (typeof text === 'string') {
    debug.log(text ?? 'Пустое тело ошибки');
    console.log(text);
  }

  if (isPlainObject(text)) {
    const toLog = JSON.stringify(text);
    debug.log(toLog);
    console.log(toLog);
  }
};

export const logError = (e: unknown, tag?: string) => {
  logInfo(`[${tag}] Ошибка: ${(e as Error).message}`);
};
