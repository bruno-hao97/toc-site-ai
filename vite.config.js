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
      // PHP bridge trên VPS — ưu tiên trước /api → Node
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