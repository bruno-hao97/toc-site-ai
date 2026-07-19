#!/usr/bin/env bash
# Chạy trên VPS trong thư mục project (sau khi git pull / upload code)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Install deps"
npm ci

echo "==> Build frontend + server"
npm run build || npx vite build
npm run build:server

if [[ ! -f .env ]]; then
  echo "==> Create .env from example"
  cp deploy/env.production.example .env
  echo "!! Sửa .env (JWT_SECRET, AUTH_BRIDGE_URL) rồi chạy lại pm2"
fi

# Đảm bảo AUTH_BRIDGE dùng localhost trên VPS
if ! grep -q '^AUTH_BRIDGE_URL=' .env 2>/dev/null; then
  echo 'AUTH_BRIDGE_URL=http://127.0.0.1/api/platform' >> .env
fi

echo "==> Start / restart PM2"
if command -v pm2 >/dev/null 2>&1; then
  pm2 startOrReload deploy/ecosystem.config.cjs --update-env
  pm2 save
else
  echo "pm2 chưa cài — chạy: npm i -g pm2 && pm2 start deploy/ecosystem.config.cjs"
fi

echo "==> Health check"
sleep 1
curl -sS "http://127.0.0.1:3001/api/health" || true
echo
echo "Xong. Nhớ dán deploy/aapanel-nginx-snippet.conf vào aaPanel nginx config."
