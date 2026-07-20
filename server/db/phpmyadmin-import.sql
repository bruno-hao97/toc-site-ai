-- Paste vào phpMyAdmin (SQL tab) trên VPS nếu migrate từ máy local bị timeout.
-- Database: sql_pro_agi_vn

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(32) NULL,
  name VARCHAR(255) NULL,
  password_hash VARCHAR(255) NOT NULL,
  credits INT NOT NULL DEFAULT 0,
  is_admin TINYINT(1) NOT NULL DEFAULT 0,
  admin_singleton TINYINT GENERATED ALWAYS AS (
    CASE WHEN is_admin = 1 THEN 1 ELSE NULL END
  ) STORED,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_single_admin (admin_singleton)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS provider_accounts (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  provider VARCHAR(64) NOT NULL,
  external_user_id VARCHAR(255) NULL,
  meta_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_provider (user_id, provider),
  CONSTRAINT fk_provider_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Nếu bảng users đã có sẵn, chạy thêm:
-- ALTER TABLE users ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0 AFTER credits;
-- ALTER TABLE users ADD COLUMN admin_singleton TINYINT GENERATED ALWAYS AS
--   (CASE WHEN is_admin = 1 THEN 1 ELSE NULL END) STORED,
--   ADD UNIQUE KEY uq_users_single_admin (admin_singleton);
-- ALTER TABLE provider_accounts DROP COLUMN access_token;
-- và nội dung server/db/credits-migration.sql
