import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api/mock-copilotkit': {
        target: 'http://localhost:3001/api/copilotkit',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/mock-copilotkit/, '')
      }
    }
  },
  define: {
    global: 'globalThis'
  }
});