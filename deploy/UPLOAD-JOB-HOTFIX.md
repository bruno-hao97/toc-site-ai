# Upload hotfix job-create (sửa lỗi normalize_stored_job_status)

## Bạn CHƯA upload thành công nếu:

- `https://pro.agi.vn/api/platform/job-bridge-health.php` → **404** (ảnh bạn gửi)
- Tạo ảnh vẫn báo `Call to undefined function normalize_stored_job_status()`
- Response lỗi **không có** `"bridgeBuild":"2026-07-20-hotfix2"`

## Bước 1 — Tìm đúng thư mục trên VPS

1. Đăng nhập **aaPanel** → **Files**
2. Vào `/www/wwwroot/pro.agi.vn/` (hoặc thư mục site của bạn)
3. **Search** (tìm file) tên: `login.php`
4. Mở thư mục chứa `login.php` — phải là thư mục có URL:
   `https://pro.agi.vn/api/platform/login.php`
5. Cùng thư mục đó phải có sẵn: `job-create.php`, `job-models.php`, `me.php`

## Bước 2 — Upload (chỉ 1 file bắt buộc)

Từ máy local, upload **ghi đè** file:

```
server/php-bridge/job-create.php  →  (thư mục bước 1)/job-create.php
```

**Upload → chọn Replace / Ghi đè** nếu aaPanel hỏi.

## Bước 3 — Kiểm tra đã lên đúng chưa

Mở trình duyệt:

```
https://pro.agi.vn/api/platform/job-create.php?probe=1
```

**Kỳ vọng (JSON):**

```json
{
  "success": true,
  "data": {
    "bridgeBuild": "2026-07-20-hotfix2",
    "normalize_stored_job_status": true
  }
}
```

Nếu vẫn 404 hoặc 405 không có JSON trên → **sai thư mục** hoặc **chưa ghi đè**.

## Bước 4 — Test tạo ảnh

1. Reload `http://localhost:5173/image`
2. Tạo ảnh lại
3. Network → `job-create.php`:
   - Thành công: `"bridgeVersion":"2026-07-20-hotfix2"`
   - Lỗi khác (không còn normalize_stored_job_status): upload đã OK, báo lại lỗi mới

## Lưu ý

- Sửa code trên máy local **không tự lên VPS** — bắt buộc upload qua aaPanel/FTP.
- `job-bridge-health.php` là file tùy chọn; dùng `?probe=1` trên job-create là đủ.
