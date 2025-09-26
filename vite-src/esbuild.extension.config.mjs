import { build } from 'esbuild';

build({
  entryPoints: ['extension/src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: './dist/extension.js',
  sourcemap: true,
  minify: true,
}).catch((err) => {
  console.log(err);
  process.exit(1);
});
