import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },

  server: {
    host: true,             // hoặc "0.0.0.0"
    port: 5173,
    allowedHosts: true,     // Cho phép Cloudflare Tunnel

    proxy: {
      // Local Node — trước proxy PHP bridge VPS
      '/api/platform/job-create.php': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/platform/job-poll.php': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/platform/token-me.php': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/platform/gw.php': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // PHP bridge trên VPS — các endpoint còn lại
      '/api/platform': {
        target: 'https://pro.agi.vn',
        changeOrigin: true,
        secure: false,
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/ai': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/v2': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});