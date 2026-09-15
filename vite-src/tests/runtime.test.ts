import { afterEach, beforeEach, expect, it } from 'vitest';
import { build } from 'esbuild';
import { WebSocketServer, type WebSocket } from 'ws';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import { temporary, removeTemporary } from './fixtures';
let dir: string;
let child: ChildProcess | undefined;
let server: WebSocketServer | undefined;
beforeEach(async () => {
  dir = await temporary();
});
afterEach(async () => {
  if (child && child.exitCode === null) {
    const done = new Promise<void>((resolve) => child!.once('exit', () => resolve()));
    child.kill();
    await done;
  }
  if (server) {
    for (const client of server.clients) client.terminate();
    await new Promise<void>((resolve) => server!.close(() => resolve()));
  }
  child = undefined;
  server = undefined;
  await removeTemporary(dir);
});
it('runs the actual bundled extension: handshake, token secrecy, single instance and clean shutdown', async () => {
  const bundle = path.join(dir, 'extension.cjs');
  await build({
    entryPoints: ['extension/src/index.ts'],
    bundle: true,
    platform: 'node',
    target: 'node22',
    outfile: bundle,
    define: { 'process.env.VITE_API_URL': JSON.stringify('http://127.0.0.1:3001/') },
  });
  server = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  await new Promise<void>((resolve) => server!.once('listening', resolve));
  const port = (server.address() as { port: number }).port;
  const connection = new Promise<WebSocket>((resolve) => server!.once('connection', resolve));
  const command = process.env.VLAUNCHER_TEST_PACKAGED
    ? path.resolve(process.env.VLAUNCHER_TEST_PACKAGED)
    : process.execPath;
  const args = process.env.VLAUNCHER_TEST_PACKAGED ? [] : [bundle];
  child = spawn(command, args, {
    cwd: dir,
    windowsHide: true,
    env: { ...process.env, LOCALAPPDATA: dir },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout!.on('data', (b) => {
    output += b.toString();
  });
  child.stderr!.on('data', (b) => {
    output += b.toString();
  });
  const exit = new Promise<number | null>((resolve, reject) => {
    child!.once('exit', resolve);
    child!.once('error', reject);
  });
  const input = JSON.stringify({
    nlPort: port,
    nlToken: 'test-private-token',
    nlConnectToken: 'test-connect-token',
    nlExtensionId: 'fileLoader',
  });
  child.stdin!.end(input);
  const socket = await connection;
  const event = (name: string) =>
    new Promise<void>((resolve) => {
      const handler = (bytes: Buffer) => {
        const message = JSON.parse(bytes.toString());
        if (message.data?.data?.event === name) {
          socket.off('message', handler);
          resolve();
        }
      };
      socket.on('message', handler);
    });
  const ready = event('extensionReady');
  socket.send(JSON.stringify({ event: 'Hello' }));
  await ready;
  const second = spawn(command, args, {
    cwd: dir,
    windowsHide: true,
    env: { ...process.env, LOCALAPPDATA: dir },
    stdio: ['pipe', 'ignore', 'ignore'],
  });
  const secondExit = new Promise<number | null>((resolve) => second.once('exit', resolve));
  second.stdin!.on('error', () => {});
  second.stdin!.end(input);
  expect(await secondExit).toBe(1);
  const closed = event('shutdownComplete');
  socket.send(JSON.stringify({ event: 'terminate' }));
  await closed;
  expect(await exit).toBe(0);
  expect(output).not.toContain('test-private-token');
  expect(output).not.toContain('test-connect-token');
  await expect(fs.stat(path.join(dir, 'VLauncher/instance.lock'))).rejects.toThrow();
}, 20000);
