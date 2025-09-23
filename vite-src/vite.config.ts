import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
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
    server: {
      proxy: {
        '/api': {
          target: env.VITE_API_URL,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  };
});
