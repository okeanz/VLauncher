import { expect, it } from 'vitest';
import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { recover } from '../extension/src/updater';
import { temporary, removeTemporary, put } from './fixtures';

it('recovers actual on-disk changes after the installer process exits mid-transaction', async () => {
  const dir = await temporary();
  try {
    const game = path.join(dir, 'game');
    const stage = path.join(dir, 'stage');
    await put(game, 'valheim.exe');
    await put(game, 'BepInEx/core/BepInEx.dll', 'old-core');
    await put(game, 'winhttp.dll', 'old-loader');
    await put(stage, 'BepInEx/core/BepInEx.dll', 'new-core');
    await put(stage, 'winhttp.dll', 'new-loader');
    const updater = path.resolve('extension/src/updater.ts');
    const executable = path.join(dir, 'crash.cjs');
    await build({
      stdin: { contents: `import { commitInstall } from ${JSON.stringify(updater)}; let writes = 0; commitInstall(process.argv[2], process.argv[3], 'r2', undefined, () => { if (++writes === 2) process.exit(91); }).catch(() => process.exit(92));`, resolveDir: process.cwd() },
      bundle: true, platform: 'node', outfile: executable,
    });
    const child = spawn(process.execPath, [executable, game, stage], { windowsHide: true, stdio: 'ignore' });
    const code = await new Promise<number | null>((resolve, reject) => { child.once('exit', resolve); child.once('error', reject); });
    expect(code).toBe(91);
    expect(await fs.readFile(path.join(game, 'BepInEx/core/BepInEx.dll'), 'utf8')).toBe('new-core');
    await recover(game);
    expect(await fs.readFile(path.join(game, 'BepInEx/core/BepInEx.dll'), 'utf8')).toBe('old-core');
    expect(await fs.readFile(path.join(game, 'winhttp.dll'), 'utf8')).toBe('old-loader');
    await expect(fs.stat(path.join(game, '.vlauncher/journal.json'))).rejects.toThrow();
  } finally { await removeTemporary(dir); }
});
