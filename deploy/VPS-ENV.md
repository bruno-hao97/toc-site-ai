# Cấu hình `.env` production trên VPS

## 1. Copy file env

Gửi file **`production.env`** (ở root repo) cho chủ VPS qua kênh riêng tư.

Trên VPS:

```bash
cd /www/wwwroot/pro.agi.vn
cp production.env .env
chmod 600 .env
```

(`jwt_secret` trong `.env` phải trùng `config.local.php` tại `/api/platform/` — hiện đã khớp.)

## 2. Build + PM2

```bash
npm ci
npm run build:prod
pm2 startOrReload deploy/ecosystem.config.cjs --update-env
pm2 save
```

## 3. Nginx (aaPanel)

Dán **`deploy/aapanel-nginx-snippet.conf`** vào cấu hình site `pro.agi.vn` (block Pay2S đã bật sẵn) → Save → Reload.

## 4. Pay2S dashboard

- Webhook sự kiện **Tiền vào**
- URL: `https://pro.agi.vn/api/pay2s/ipn`
- Tài khoản: `01868692631111` (MBB)

## 5. Kiểm tra

```bash
curl -s http://127.0.0.1:3001/api/health
curl -s https://pro.agi.vn/api/pay2s/status
curl -s https://pro.agi.vn/api/pay2s/ipn
```

Kỳ vọng IPN: `{"success":true,"message":"Pay2S IPN endpoint ready"}`
