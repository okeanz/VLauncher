import fs from 'node:fs/promises';
import path from 'node:path';
import { exists } from '../updater.js';
const settings = [
  'gfx-enable-gfx-jobs=1',
  'gfx-enable-native-gfx-jobs=1',
  'vr-enabled=0',
  'scripting-runtime-version=latest',
];
export async function getOptimization(game: string): Promise<boolean> {
  const file = path.join(game, 'valheim_Data', 'boot.config');
  if (!(await exists(file)) || !(await exists(file + '.vlauncher-backup'))) return false;
  const lines = (await fs.readFile(file, 'utf8')).split(/\r?\n/).map((line) => line.trim());
  return settings.every((setting) => lines.includes(setting));
}
export async function setOptimization(game: string, enabled: boolean) {
  const directory = path.join(game, 'valheim_Data');
  const file = path.join(directory, 'boot.config');
  const backup = file + '.vlauncher-backup';
  const temp = file + '.vlauncher-tmp';
  for (const target of [directory, file, backup, temp]) {
    if ((await exists(target)) && (await fs.lstat(target)).isSymbolicLink())
      throw new Error('Ссылки в Boot.config не поддерживаются');
  }
  const content = await fs.readFile(file, 'utf8');
  const apply = (original: string) => {
    const keys = new Set(settings.map((line) => line.split('=')[0]));
    const newline = original.includes('\r\n') ? '\r\n' : '\n';
    return (
      original
        .split(/\r?\n/)
        .filter((line) => !keys.has(line.trim().split('=')[0]))
        .join(newline)
        .replace(/\r?\n$/, '') +
      newline +
      settings.join(newline) +
      newline
    );
  };
  if (enabled) {
    if (await exists(backup)) {
      const original = await fs.readFile(backup, 'utf8');
      if (content === apply(original)) return;
      if (content !== original)
        throw new Error(
          'Boot.config изменён другой программой; сначала восстановите резервную копию',
        );
    } else await fs.writeFile(backup, content, { flag: 'wx' });
    await fs.writeFile(temp, apply(content));
    await fs.rename(temp, file);
  } else if (await exists(backup)) {
    const original = await fs.readFile(backup, 'utf8');
    if (content !== original && content !== apply(original))
      throw new Error('Boot.config изменён другой программой; резервная копия сохранена');
    await fs.writeFile(temp, original);
    await fs.rename(temp, file);
    await fs.unlink(backup);
  }
}
