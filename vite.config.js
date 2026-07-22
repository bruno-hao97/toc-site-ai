import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: { '@': path.resolve(__dirname, 'src') },
    },
    server: {
        host: true,
        port: 5173,
        allowedHosts: true,
        proxy: {
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
            '/api/platform/admin-vmedia-balance.php': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
            '/api/platform/gw.php': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
            '/api/platform/mine-media.php': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
            '/api/platform': {
                target: 'https://pro.agi.vn',
                changeOrigin: true,
                secure: false,
            },
            '/api': { target: 'http://localhost:3001', changeOrigin: true },
            '/ai': { target: 'http://localhost:3001', changeOrigin: true },
            '/v2': { target: 'http://localhost:3001', changeOrigin: true },
        },
    },
});
