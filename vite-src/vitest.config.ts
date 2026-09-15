import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    testTimeout: 15000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: [
        'extension/src/**/*.ts',
        'src/features/**/*.ts',
        'src/shared/actions/**/*.ts',
        'src/utils/{get-valheim-path,find-valheim-path,launch-valheim}.ts',
        'src/events.ts',
        'src/hooks/use-valheim-optimization.ts',
        'src/components/{valheim-launch,valheim-path,valheim-optimization,loading-bar}.tsx',
      ],
      exclude: ['extension/src/index.ts', 'extension/src/utils/logger.ts'],
      thresholds: { lines: 85, functions: 85, branches: 75, statements: 85 },
    },
  },
});
