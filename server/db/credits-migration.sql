-- Credit / admin (chạy trong phpMyAdmin trên sql_pro_agi_vn)

-- Nếu báo duplicate column thì bỏ qua câu ALTER này:
ALTER TABLE users ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0 AFTER credits;

CREATE TABLE IF NOT EXISTS credit_transfers (
  id CHAR(36) NOT NULL PRIMARY KEY,
  from_user_id CHAR(36) NULL,
  to_user_id CHAR(36) NOT NULL,
  amount INT NOT NULL,
  kind VARCHAR(32) NOT NULL,
  message VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_transfers_to (to_user_id),
  KEY idx_transfers_from (from_user_id),
  CONSTRAINT fk_transfers_to FOREIGN KEY (to_user_id) REFERENCES users(id),
  CONSTRAINT fk_transfers_from FOREIGN KEY (from_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Gán quyền admin (đổi email của bạn):
-- UPDATE users SET is_admin = 1 WHERE email = 'ban@example.com';
