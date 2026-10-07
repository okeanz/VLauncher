import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fitZoom, fitWindow } from '../src/utils/fit-window';
import { appendLog, describeError } from '../extension/src/utils/file-log';

const view = (
  innerWidth: number,
  innerHeight: number,
  devicePixelRatio: number,
  avail = [2560, 1400],
) => {
  const listeners: (() => void)[] = [];
  const v = {
    innerWidth,
    innerHeight,
    devicePixelRatio,
    screen: { availWidth: avail[0], availHeight: avail[1] },
    document: { documentElement: { style: { zoom: '' } } },
    addEventListener: (_: string, f: () => void) => listeners.push(f),
    resize(w: number, h: number) {
      v.innerWidth = w;
      v.innerHeight = h;
      listeners.forEach((f) => f());
    },
  };
  return v;
};

describe('window at display scaling', () => {
  it('zooms only what does not fit', () => {
    expect(fitZoom(800, 600)).toBe(1);
    expect(fitZoom(1200, 900)).toBe(1);
    expect(fitZoom(533, 400)).toBe(0.666);
    expect(fitZoom(640, 600)).toBe(0.8);
    expect(fitZoom(0, 0)).toBe(1);
  });
  it('grows the window by the scale and zooms nothing once it fits', async () => {
    // 150%: Neutralino opened 800×600 physical pixels, the page sees 533×400.
    const v = view(533, 400, 1.5, [1706, 933]);
    const setSize = vi.fn(async () => v.resize(800, 600));
    await fitWindow(v as never, { setSize });
    expect(setSize).toHaveBeenCalledWith(
      expect.objectContaining({ width: 1200, height: 900, resizable: false }),
    );
    expect(v.document.documentElement.style.zoom).toBe('');
  });
  it('zooms down when the window cannot grow or the screen is too small', async () => {
    const v = view(533, 400, 1.5, [700, 500]);
    const setSize = vi.fn(async () => {
      throw new Error('window.setSize is not allowed');
    });
    await fitWindow(v as never, { setSize });
    // The screen holds 700×500 layout pixels: the window is not grown past it.
    expect(setSize).toHaveBeenCalledWith(expect.objectContaining({ width: 1000, height: 750 }));
    expect(v.document.documentElement.style.zoom).toBe('0.666');
    v.resize(800, 600);
    expect(v.document.documentElement.style.zoom).toBe('');
  });
  it('leaves a 100% screen alone', async () => {
    const v = view(800, 600, 1);
    const setSize = vi.fn(async () => {});
    await fitWindow(v as never, { setSize });
    expect(setSize).not.toHaveBeenCalled();
    expect(v.document.documentElement.style.zoom).toBe('');
  });
});

describe('launcher.log', () => {
  it('names the network reason behind "fetch failed" and rotates the file', async () => {
    const cause = Object.assign(new Error('getaddrinfo ENOTFOUND s3.twcstorage.ru'), {
      code: 'ENOTFOUND',
    });
    expect(describeError(new TypeError('fetch failed', { cause }))).toBe(
      'TypeError: fetch failed (ENOTFOUND getaddrinfo ENOTFOUND s3.twcstorage.ru)',
    );
    expect(describeError(new Error('Download failed: HTTP 403'))).toBe('Download failed: HTTP 403');
    expect(describeError('x')).toBe('x');
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vlauncher-log-'));
    const file = path.join(dir, 'sub', 'launcher.log');
    await appendLog('first', file);
    expect(await fs.readFile(file, 'utf8')).toMatch(/^\d{4}-\d\d-\d\dT.* first\n$/);
    await fs.writeFile(file, 'x'.repeat(600 * 1024));
    await appendLog('after rotation', file);
    expect((await fs.readFile(file, 'utf8')).trim()).toMatch(/after rotation$/);
    expect((await fs.stat(file + '.1')).size).toBe(600 * 1024);
    await appendLog('never throws', path.join(file, 'not-a-dir', 'x.log'));
    await fs.rm(dir, { recursive: true, force: true });
  });
});
