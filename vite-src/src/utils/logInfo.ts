import { debug } from '@neutralinojs/lib';
import { isPlainObject } from '@reduxjs/toolkit';

export const logInfo = (text: string | null | undefined | object, second?: object) => {
  if (typeof text === 'string') {
    const secondMsg = second ? `\n[second] ${JSON.stringify(second)}` : '';
    const msg = `[app-info] ${text} ${secondMsg}`;
    debug.log(msg);
    console.log(msg);
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
