# Upload 1 file lên VPS — cách dễ nhất (không cần Terminal)

## Vì sao hotfix-upload.php bị 404?

`deploy\print-bootstrap.cmd` **chỉ in lệnh** ra màn hình Windows.

Bạn **chưa tạo file trên VPS** nếu chưa làm một trong hai việc sau:
- Dán lệnh bash vào **aaPanel → Terminal** (trên VPS), hoặc
- Upload file qua **aaPanel → Files** (hướng dẫn bên dưới)

---

## Cách upload trực tiếp (khuyên dùng — 3 phút)

### Bước 1 — Vào aaPanel

1. Đăng nhập **aaPanel** VPS (trình duyệt)
2. Menu trái bấm **Files** (Quản lý tệp / File manager)

### Bước 2 — Tìm đúng thư mục

1. Ở góc trên có ô **Search** (Tìm kiếm)
2. Gõ: **`migrate-jobs.php`**
3. Bấm vào kết quả tìm được
4. Bạn sẽ thấy các file cùng thư mục:
   - `login.php`
   - `job-create.php`  ← file cần ghi đè
   - `migrate-jobs.php`
   - `bootstrap.php`

> Nếu search không ra: thử gõ `login.php` hoặc vào thư mục  
> `/www/wwwroot/pro.agi.vn/api/platform/`

### Bước 3 — Upload ghi đè

1. Trong thư mục đó, bấm **Upload**
2. Trên máy Windows chọn file:
   ```
   C:\Users\Admin\Documents\GitHub\toc-site-ai\server\php-bridge\job-create.php
   ```
3. Nếu hỏi **Replace / Ghi đè** → chọn **Yes / Replace**

### Bước 4 — Kiểm tra

Mở trình duyệt:

```
https://pro.agi.vn/api/platform/job-create.php?probe=1
```

**Trước khi upload (file cũ):**
```json
{"success":false,"message":"Method not allowed"}
```

**Sau khi upload OK (file mới):**
```json
{
  "success": true,
  "data": {
    "bridgeBuild": "2026-07-20-hotfix2",
    "normalize_stored_job_status": true
  }
}
```

### Bước 5 — Test tạo ảnh

1. Reload `http://localhost:5173/image`
2. Tạo ảnh thử — lỗi `normalize_stored_job_status` sẽ hết

---

## Cách B — Dùng Terminal (nếu muốn script tự động)

1. aaPanel → **Terminal** (icon dòng lệnh, trên VPS)
2. Chạy `deploy\print-bootstrap.cmd` trên Windows để xem block lệnh bash
3. **Copy block bash** → dán vào Terminal VPS → Enter
4. Chỉ khi curl trả `"ready":true` thì mới chạy `deploy\push-hotfix.cmd`

---

## Mở nhanh file cần upload trên Windows

Double-click: **`deploy\mo-thu-muc-job-create.cmd`**
