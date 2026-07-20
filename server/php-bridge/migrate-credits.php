<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$key = (string) ($_GET['key'] ?? '');
$expected = (string) (platform_config()['migrate_key'] ?? '');
if ($expected === '' || !hash_equals($expected, $key)) {
    json_out(403, ['success' => false, 'message' => 'Forbidden']);
}

try {
    $pdo = db();
    $done = [];

    $col = $pdo->query(
        "SELECT COUNT(*) AS c FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'is_admin'"
    )->fetch();
    if ((int) ($col['c'] ?? 0) === 0) {
        $pdo->exec('ALTER TABLE users ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0 AFTER credits');
        $done[] = 'added users.is_admin';
    } else {
        $done[] = 'users.is_admin exists';
    }

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS credit_transfers (
          id CHAR(36) NOT NULL PRIMARY KEY,
          from_user_id CHAR(36) NULL,
          to_user_id CHAR(36) NOT NULL,
          amount INT NOT NULL,
          kind VARCHAR(32) NOT NULL,
          message VARCHAR(500) NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          KEY idx_transfers_to (to_user_id),
          KEY idx_transfers_from (from_user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $done[] = 'credit_transfers ready';

    json_out(200, ['success' => true, 'data' => ['done' => $done]]);
} catch (Throwable $e) {
    json_out(500, ['success' => false, 'message' => $e->getMessage()]);
}
