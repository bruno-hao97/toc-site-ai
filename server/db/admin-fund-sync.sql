-- Đồng bộ quỹ ví nội bộ admin (chạy 1 lần trong phpMyAdmin nếu không dùng nút UI)
-- Công thức an toàn đối soát:
--   admin.credits = GREATEST(0, :vmedia − SUM(credits của user không phải admin))
--
-- 1) Lấy số VMedia hiện tại từ trang Ví / header (vd: 911026)
-- 2) Thay 911026 bên dưới bằng số VMedia thật của bạn
-- 3) Chạy SQL

-- Kiểm tra trước:
SELECT
  a.id AS admin_id,
  a.email,
  a.credits AS admin_credits_hien_tai,
  (SELECT COALESCE(SUM(u.credits), 0) FROM users u WHERE u.is_admin = 0) AS users_credits,
  911026 AS vmedia_gia_su,
  GREATEST(0, 911026 - (SELECT COALESCE(SUM(u.credits), 0) FROM users u WHERE u.is_admin = 0)) AS admin_credits_sau_dong_bo
FROM users a
WHERE a.is_admin = 1
LIMIT 1;

-- Áp dụng (đổi 911026 → số VMedia thật):
UPDATE users a
SET a.credits = GREATEST(
  0,
  911026 - (SELECT COALESCE(SUM(u.credits), 0) FROM (
    SELECT credits FROM users WHERE is_admin = 0
  ) u)
)
WHERE a.is_admin = 1;

-- MySQL đôi khi không cho subquery cùng bảng trong UPDATE; dùng biến:
-- SET @vmedia := 911026;
-- SET @users := (SELECT COALESCE(SUM(credits), 0) FROM users WHERE is_admin = 0);
-- UPDATE users SET credits = GREATEST(0, @vmedia - @users) WHERE is_admin = 1;

-- Kiểm tra sau:
SELECT
  a.credits AS admin_credits,
  (SELECT COALESCE(SUM(credits), 0) FROM users WHERE is_admin = 0) AS users_credits,
  a.credits + (SELECT COALESCE(SUM(credits), 0) FROM users WHERE is_admin = 0) AS sum_platform
FROM users a
WHERE a.is_admin = 1
LIMIT 1;
