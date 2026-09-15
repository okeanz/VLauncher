import fs from 'node:fs/promises';
import crypto from 'node:crypto';
export async function acquireLock(
  file: string,
  alive: (pid: number) => boolean = (pid) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch (e) {
      return (e as NodeJS.ErrnoException).code !== 'ESRCH';
    }
  },
) {
  const token = crypto.randomUUID();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await fs.writeFile(file, JSON.stringify({ pid: process.pid, token }), { flag: 'wx' });
      break;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
      const raw = await fs.readFile(file, 'utf8');
      const owner = JSON.parse(raw);
      if (
        !Number.isSafeInteger(owner.pid) ||
        owner.pid <= 0 ||
        typeof owner.token !== 'string' ||
        alive(owner.pid) ||
        attempt
      )
        throw new Error('VLauncher уже запущен или файл блокировки требует проверки');
      if ((await fs.readFile(file, 'utf8')) !== raw) throw new Error('Lock ownership changed');
      await fs.unlink(file);
    }
  }
  return async () => {
    try {
      const owner = JSON.parse(await fs.readFile(file, 'utf8'));
      if (owner.token === token) await fs.unlink(file);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
  };
}
