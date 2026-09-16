import { build } from 'esbuild';
import { loadEnv } from 'vite';
const url = process.env.VITE_API_URL || loadEnv('production', process.cwd(), 'VITE_').VITE_API_URL;
if (!url) throw new Error('Set VITE_API_URL before building the launcher');
const parsed = new URL(url);
const privateIpv4 = /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})$/;
const trustedHttpHost =
  ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) || privateIpv4.test(parsed.hostname);
if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && trustedHttpHost))
  throw new Error('VITE_API_URL requires HTTPS, except localhost or private LAN addresses');
if (parsed.username || parsed.password || parsed.hash || parsed.search)
  throw new Error('VITE_API_URL must not contain credentials, query or fragment');
await build({
  entryPoints: ['extension/src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  outfile: './dist/extension.cjs',
  sourcemap: false,
  minify: false,
  define: { 'process.env.VITE_API_URL': JSON.stringify(url) },
});
