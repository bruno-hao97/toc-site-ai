# Deploy lên VPS (pro.agi.vn)

## Vì sao local OK mà domain lỗi 404 HTML?

Frontend gọi `/api/auth/login` — local có Vite proxy sang Node, production cần **Node API + nginx proxy** *hoặc* rewrite sang PHP bridge.

## Cách nhanh (chỉ đăng ký / đăng nhập)

Xem **[HUONG-DAN-AAPANEL.md](./HUONG-DAN-AAPANEL.md)** — dán `aapanel-nginx-snippet.conf` vào aaPanel (~2 phút). Không cần Node.

## Các bước đầy đủ trên VPS (Node)

```bash
# 1. Build
npm ci
npm run build:prod

# 2. Env
cp deploy/env.production.example .env
# Sửa JWT_SECRET, GOMMO_ACCESS_TOKEN, PayOS...

# 3. Chạy API bằng PM2
pm2 start deploy/ecosystem.config.cjs
pm2 save

# 4. Nginx — thêm proxy /api, /ai, /v2 (xem deploy/nginx.pro.agi.vn.conf)
# aaPanel: Website → pro.agi.vn → Config → paste các location block
nginx -t && nginx -s reload

# 5. Copy dist lên webroot (nếu dùng Cách 1)
cp -r dist/* /www/wwwroot/pro.agi.vn/dist/
```

## Kiểm tra

```bash
curl -s https://pro.agi.vn/api/health
# → {"success":true,"data":{"ok":true,...}}
```

## PHP bridge

Đảm bảo `server/php-bridge/` đã deploy tại `/api/platform/` và có `config.local.php`.
