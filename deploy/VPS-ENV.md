# Cấu hình `.env` production trên VPS

## 1. Copy file env

**Từ máy Windows** (sau khi sửa `.env` local):

```cmd
deploy\sync-production-env.ps1
deploy\push-env.cmd
```

(`push-env` cần `deploy\ftp.local.ps1` — copy từ `ftp.local.example.ps1`.)

**Hoặc** gửi file **`production.env`** (ở root repo) cho chủ VPS qua kênh riêng tư.

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

Sau khi gắn webhook xong:

1. Copy **token Bearer** Pay2S hiện khi tạo webhook vào `.env`:
   ```bash
   PAY2S_WEBHOOK_TOKEN=...token_tu_pay2s...
   PAY2S_QR_ENABLED=true
   ```
2. Deploy `admin-balance.php` (PHP bridge) — Node dùng endpoint này để check ví admin trước khi trả QR.
3. Đảm bảo Nginx proxy `/api/pay2s/` có `proxy_set_header Authorization $http_authorization;`
4. Reload:
   ```bash
   pm2 startOrReload deploy/ecosystem.config.cjs --update-env
   ```

Trước khi trả QR, server check **2 ví** (admin platform + Gommo) còn đủ gói + buffer **500.001**. Không đủ → báo tạm dừng, không tạo QR.

Kiểm tra: `curl -s https://pro.agi.vn/api/pay2s/status` → `qrEnabled: true`, `webhookTokenConfigured: true`.

## 5. Kiểm tra

```bash
curl -s http://127.0.0.1:3001/api/health
curl -s https://pro.agi.vn/api/pay2s/status
curl -s https://pro.agi.vn/api/pay2s/ipn
```

Kỳ vọng IPN: `{"success":true,"message":"Pay2S IPN endpoint ready"}`
