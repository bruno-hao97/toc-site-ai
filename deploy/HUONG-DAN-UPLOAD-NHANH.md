# Upload hotfix lên VPS — hướng dẫn đơn giản

## Vấn đề

Code trên máy bạn **đã sửa xong**, nhưng VPS (`pro.agi.vn`) vẫn chạy file cũ.

Kiểm tra: mở trình duyệt

```
https://pro.agi.vn/api/platform/job-create.php?probe=1
```

- **Chưa OK:** `{"success":false,"message":"Method not allowed"}` (không có `bridgeBuild`)
- **Đã OK:** `"bridgeBuild":"2026-07-20-hotfix2"`

---

## Cách A — Tự động (khuyên dùng)

### Bước 0 — In lệnh bootstrap (nếu chưa biết aaPanel Files)

Trên máy Windows, mở PowerShell **hoặc CMD**:

```cmd
cd C:\Users\Admin\Documents\GitHub\toc-site-ai
deploy\print-bootstrap.cmd
```

> **Lưu ý:** Nếu gõ `.\deploy\push-bridge-hotfix.ps1` trong CMD, Windows có thể hỏi "How do you want to open this file?" — dùng file `.cmd` ở trên thay vì `.ps1`.

Copy block lệnh `bash` → dán vào **aaPanel → Terminal** (SSH) trên VPS → Enter.

### Bước 1 — Paste file bootstrap (chỉ 1 lần, nếu không dùng Terminal)

1. Đăng nhập **aaPanel** VPS
2. Menu trái: **Files** (Quản lý tệp)
3. Ô **Search** (tìm kiếm) gõ: `login.php`
4. Click kết quả → bạn sẽ thấy thư mục có các file:
   - `login.php`, `job-create.php`, `migrate-jobs.php`, `bootstrap.php` …
5. **New** → **File** → tên: `hotfix-upload.php`
6. Trên máy Windows mở file:
   ```
   server\php-bridge\hotfix-upload.php
   ```
   Copy toàn bộ → Paste vào aaPanel → **Save**

### Bước 2 — Chạy script trên máy bạn

Trong CMD (cùng thư mục project):

```cmd
cd C:\Users\Admin\Documents\GitHub\toc-site-ai
deploy\push-hotfix.cmd
```

Script tự upload `job-create.php` (và các file liên quan).

### Bước 3 — Kiểm tra

Probe URL phải trả JSON có `bridgeBuild: 2026-07-20-hotfix2`.

---

## Cách B — Upload thủ công (nếu không dùng script)

1. aaPanel → Files → Search `login.php` (cùng thư mục như trên)
2. **Upload** file từ máy:
   ```
   server\php-bridge\job-create.php
   ```
3. Chọn **Replace / Ghi đè** khi hỏi
4. Kiểm tra probe URL ở trên

---

## Đường dẫn thường gặp trên VPS

Một trong các path sau (tùy cấu hình aaPanel):

- `/www/wwwroot/pro.agi.vn/api/platform/`
- `/www/wwwroot/pro.agi.vn/public/api/platform/`

**Cách chắc chắn nhất:** search `login.php` — thư mục chứa file đó là đúng.

---

## Sau khi upload OK

1. Reload `http://localhost:5173/image`
2. Tạo ảnh thử
3. Lỗi `normalize_stored_job_status` sẽ hết
