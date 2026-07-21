# Sửa đăng ký / đăng nhập trên pro.agi.vn (aaPanel)

## Tình trạng hiện tại

| URL | Kết quả |
|-----|---------|
| `https://pro.agi.vn/api/platform/login.php` | OK (PHP bridge) |
| `https://pro.agi.vn/api/auth/login` | **404** ← frontend gọi cái này |

## Cách nhanh (2 phút) — chỉ cần nginx

1. Đăng nhập **aaPanel** trên VPS.
2. **Website** → site `pro.agi.vn` → **Cấu hình** (Config).
3. Copy toàn bộ nội dung file `deploy/aapanel-nginx-snippet.conf` (các block `location = /api/auth/...`).
4. Dán **phía trên** dòng `location /` hoặc `location ~ \.php`.
5. **Save** → Reload nginx.
6. Kiểm tra trên máy:
   ```bash
   curl -s -X POST https://pro.agi.vn/api/auth/login \
     -H "Content-Type: application/json" \
     -d "{\"email\":\"x\",\"password\":\"y\"}"
   ```
   Kỳ vọng: JSON `Email hoặc mật khẩu không đúng` — **không** còn HTML 404.
7. Thử đăng ký lại trên https://pro.agi.vn/register

## Cách đầy đủ (Node + Pay2S + Gommo proxy)

Cần SSH vào VPS, rồi:

```bash
cd /www/wwwroot/pro.agi.vn   # hoặc thư mục project của bạn
# upload / git pull code mới
bash deploy/setup-vps.sh
```

Sau đó bỏ comment các block `# location /api/pay2s/` (và alias `/api/payos/` nếu cần) trong snippet nginx.

## Nếu muốn mình cấu hình remote

Gửi **SSH** (host + user + password hoặc private key). Máy local hiện bị `Permission denied`.
