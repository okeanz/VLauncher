import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// https://vitejs.dev/config/
// VLAUNCHER_PROFILE (dev | prod) picks .env.dev or .env.prod; see scripts/build-app.mjs.
export default defineConfig(() => {
  return {
    mode: process.env.VLAUNCHER_PROFILE || undefined,
    plugins: [react()],
    resolve: {
      alias: {
        '@': '/src',
      },
    },
    optimizeDeps: {
      include: [
        '@reduxjs/toolkit',
        '@mantine/core',
        '@tabler/icons-react',
        'react-redux',
        'react-error-boundary',
        'react-router-dom',
        'react-dom/client',
      ],
    },
  };
});
