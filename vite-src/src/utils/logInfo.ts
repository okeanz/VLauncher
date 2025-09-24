import { debug } from '@neutralinojs/lib';
import { isPlainObject } from '@reduxjs/toolkit';

export const logInfo = (text: string | null | undefined | object, second?: object) => {
  if (typeof text === 'string') {
    debug.log(text ?? 'Пустое тело ошибки');
    debug.log(JSON.stringify(second) ?? 'Пустое тело ошибки');
    console.log(text, second);
  }

  if (isPlainObject(text)) {
    const toLog = JSON.stringify(text);
    debug.log(toLog);
    if (second) {
      debug.log(JSON.stringify(second));
    }
    console.log(toLog, second);
  }
};

export const logError = (e: unknown, tag?: string) => {
  logInfo(`[${tag}] Ошибка: ${(e as Error).message}`);
};
