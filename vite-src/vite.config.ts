import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// https://vitejs.dev/config/
export default defineConfig(() => {
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
  };
});
