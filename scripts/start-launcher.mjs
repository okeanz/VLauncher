// Запуск VLauncher с автоматическим SSH-туннелем к панели kuberheim на Mac.
// Лаунчер собран с VITE_API_URL=http://127.0.0.1:4179/, туннель пробрасывает
// 127.0.0.1:4179 -> 127.0.0.1:4178 на хосте alfa@192.168.50.181.
import { spawn } from 'node:child_process';
import { existsSync, openSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const executable = path.join(root, 'dist/VLauncher/VLauncher-win_x64.exe');
const identity = path.join(os.homedir(), '.ssh/kuberheim_macos');
const knownHosts = process.env.KUBERHEIM_KNOWN_HOSTS || 'E:/Github/kuberheim/.local/known_hosts';
const host = process.env.KUBERHEIM_SSH_HOST || 'alfa@192.168.50.181';
const healthUrl = 'http://127.0.0.1:4179/health';

async function healthy() {
  try {
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(2000) });
    const body = await response.json();
    return response.ok && body.app === 'kuberheim';
  } catch {
    return false;
  }
}

try {
  if (!existsSync(executable)) throw new Error('Сначала соберите VLauncher (npm run build:app): исполняемый файл не найден.');
  if (!(await healthy())) {
    if (!existsSync(identity)) throw new Error('SSH-ключ kuberheim_macos не найден.');
    if (!existsSync(knownHosts)) throw new Error(`known_hosts не найден: ${knownHosts}`);
    const log = openSync(path.join(root, 'launcher-tunnel.log'), 'a');
    const tunnel = spawn(
      'C:/Windows/System32/OpenSSH/ssh.exe',
      [
        '-N', '-T', '-i', identity,
        '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
        '-o', `UserKnownHostsFile=${knownHosts}`, '-o', 'ExitOnForwardFailure=yes',
        '-o', 'ConnectTimeout=10', '-o', 'ServerAliveInterval=30', '-o', 'ServerAliveCountMax=3',
        '-L', '127.0.0.1:4179:127.0.0.1:4178', host,
      ],
      { detached: true, windowsHide: true, stdio: ['ignore', log, log] },
    );
    let failure;
    tunnel.on('error', (e) => { failure = e; });
    tunnel.unref();
    for (let i = 0; i < 20 && !(await healthy()); i++) {
      if (failure) throw failure;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (!(await healthy())) throw new Error('Mac недоступен. Проверьте сеть, панель kuberheim и launcher-tunnel.log.');
  }
  const launcher = spawn(executable, [], { cwd: path.dirname(executable), detached: true, stdio: 'ignore' });
  await new Promise((resolve, reject) => { launcher.once('spawn', resolve); launcher.once('error', reject); });
  launcher.unref();
  console.log('VLauncher открыт. Файлы поступают с Mac через SSH-туннель.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
