/** PM2 — chạy trên VPS: pm2 start deploy/ecosystem.config.cjs */
module.exports = {
  apps: [
    {
      name: 'toc-site-api',
      cwd: __dirname + '/..',
      script: 'dist-server/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
    },
  ],
};
