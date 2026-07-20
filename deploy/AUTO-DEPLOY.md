# Auto-deploy khi push `main` (FTP)

Mỗi lần merge/push vào `main`, GitHub Actions sẽ:

1. `npm ci` + `npm run build`
2. Upload `dist/` → webroot FTP `/`
3. Upload `server/php-bridge/*.php` → `/api/platform/`  
   (**không** upload `config.local.php`)

Workflow: [`.github/workflows/deploy-ftp.yml`](../.github/workflows/deploy-ftp.yml)

---

## Bước 1 — Thêm GitHub Secrets (bắt buộc, 1 lần)

1. Mở: https://github.com/bruno-hao97/toc-site-ai/settings/secrets/actions  
2. **New repository secret** — tạo 3 secrets:

| Name | Value (ví dụ) |
|------|----------------|
| `FTP_SERVER` | `14.225.211.21` |
| `FTP_USERNAME` | `ftp_pro_agi_vn` |
| `FTP_PASSWORD` | *(mật khẩu FTP trong FileZilla)* |

3. (Tuỳ chọn) Nếu FTP bắt buộc FTPS:  
   **Settings → Secrets and variables → Actions → Variables**  
   thêm `FTP_PROTOCOL` = `ftps`

---

## Bước 2 — Đẩy workflow lên GitHub

Sau khi commit file workflow lên `main`, mỗi push tiếp theo sẽ tự deploy.

Chạy thủ công lần đầu (sau khi đã có Secrets):

1. https://github.com/bruno-hao97/toc-site-ai/actions  
2. Chọn **Deploy FTP (pro.agi.vn)** → **Run workflow** → `main`

---

## Kiểm tra sau deploy

- https://pro.agi.vn (Ctrl+F5)
- https://pro.agi.vn/api/platform/job-create.php?probe=1  
  Kỳ vọng JSON có `bridgeBuild`

Xem log: **Actions** → run mới nhất → nếu đỏ = sai mật khẩu FTP / protocol / path.

---

## Deploy tay trên Windows (không chờ Actions)

```cmd
copy deploy\ftp.local.example.ps1 deploy\ftp.local.ps1
notepad deploy\ftp.local.ps1
deploy\deploy-ftp.cmd
```

`ftp.local.ps1` đã có trong `.gitignore` — không commit mật khẩu.

---

## Lưu ý

- Auto-deploy **không** cài Node/PM2/nginx trên VPS — chỉ sync frontend + PHP bridge.
- Không xoá file trên server (`dangerous-clean-slate: false`) nên `config.local.php` an toàn.
- File JS/CSS cũ trong `/assets` có thể còn sót (hash tên khác) — không ảnh hưởng site.
