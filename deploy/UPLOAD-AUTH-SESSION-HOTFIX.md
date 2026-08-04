# Upload hotfix phiên đăng nhập (JWT refresh + lỗi thân thiện)

## Mục tiêu

- Không còn **Fatal error / stack trace PHP** khi token hết hạn
- Tự **gia hạn JWT** im lặng (30 ngày TTL + grace 30 ngày)
- Frontend hiện **modal "Phiên hết hạn"** thay vì redirect cứng

## Bước 1 — Tìm thư mục PHP trên VPS

1. aaPanel → **Files** → `/www/wwwroot/pro.agi.vn/`
2. Tìm file `login.php` có URL: `https://pro.agi.vn/api/platform/login.php`
3. Upload **ghi đè** vào cùng thư mục đó

## Bước 2 — Upload các file PHP

Từ repo local `server/php-bridge/`:

| File local | Upload lên VPS |
|------------|----------------|
| `bootstrap.php` | `bootstrap.php` |
| `me.php` | `me.php` |
| `refresh-token.php` | `refresh-token.php` *(mới)* |
| `auth-session-health.php` | `auth-session-health.php` *(mới)* |

## Bước 3 — Cập nhật config trên VPS

Trong `config.local.php` trên server, thêm hoặc sửa:

```php
'jwt_expires_seconds' => 2592000,       // 30 ngày
'jwt_refresh_grace_seconds' => 2592000, // grace 30 ngày
```

## Bước 4 — Kiểm tra health

Mở trình duyệt:

```
https://pro.agi.vn/api/platform/auth-session-health.php
```

**Kỳ vọng (JSON):**

```json
{
  "success": true,
  "data": {
    "bridgeBuild": "2026-08-04-auth-session",
    "jwtRefreshEndpoint": true,
    "jwtExpiresSeconds": 2592000,
    "jwtRefreshGraceSeconds": 2592000,
    "friendlyAuthErrors": true
  }
}
```

Nếu **404** → sai thư mục hoặc chưa upload `auth-session-health.php`.

## Bước 5 — Test token hết hạn

1. Deploy frontend mới (build + upload `dist/`)
2. Mở trang **Nhạc** (`/music`)
3. Nếu token cũ hết hạn:
   - **Trước:** stack trace PHP dài
   - **Sau:** modal *"Phiên đăng nhập hết hạn"* + nút **Đăng nhập lại**
4. Hoặc app tự refresh im lặng nếu token còn trong grace period

## Bước 6 — Nginx (tuỳ chọn)

Nếu dùng rewrite `/api/auth/*`, thêm vào aaPanel nginx config:

```nginx
location = /api/auth/refresh {
    rewrite ^ /api/platform/refresh-token.php last;
}
```

(Xem `deploy/aapanel-nginx-snippet.conf`)

## Deploy frontend

```bash
npm run build
```

Upload nội dung thư mục `dist/` lên web root (hoặc chạy script deploy FTP có sẵn).

## Lưu ý

- Sửa code local **không tự lên VPS** — bắt buộc upload PHP + build frontend.
- User đang có token cũ (7 ngày) vẫn refresh được trong **30 ngày grace** sau khi deploy backend.
