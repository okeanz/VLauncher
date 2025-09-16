import { debug } from '@neutralinojs/lib';

export const log = (text: string | null | undefined) => {
  debug.log(text ?? 'Пустое тело ошибки');
  console.log(text);
};
