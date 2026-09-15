import { build } from 'esbuild';
import { loadEnv } from 'vite';
const url = process.env.VITE_API_URL || loadEnv('production', process.cwd(), 'VITE_').VITE_API_URL;
if (!url) throw new Error('Set VITE_API_URL before building the launcher');
const parsed = new URL(url);
if (
  parsed.protocol !== 'https:' &&
  !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname))
)
  throw new Error('VITE_API_URL requires HTTPS, except localhost');
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
