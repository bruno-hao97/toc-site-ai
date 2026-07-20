<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$key = (string) ($_GET['key'] ?? '');
$cfg = platform_config();
$expected = (string) ($cfg['migrate_key'] ?? '');
if ($expected === '' || !hash_equals($expected, $key)) {
    json_out(403, ['success' => false, 'message' => 'Forbidden']);
}

$pdo = db();
$adminEmail = configured_admin_email();
$admin = find_user_by_email($pdo, $adminEmail);
if (!$admin) {
    json_out(400, ['success' => false, 'message' => 'Admin cấu hình chưa tồn tại trong DB']);
}

try {
    $adminFlag = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = \'users\'
           AND COLUMN_NAME = \'is_admin\''
    );
    $adminFlag->execute();
    if ((int) $adminFlag->fetchColumn() === 0) {
        $pdo->exec('ALTER TABLE users ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0 AFTER credits');
    }

    $pdo->exec('UPDATE users SET is_admin = 0 WHERE is_admin <> 0');
    $pdo->prepare('UPDATE users SET is_admin = 1 WHERE LOWER(email) = ?')->execute([$adminEmail]);

    // Unique generated key: DB từ chối mọi thao tác tạo admin thứ hai.
    $adminSlot = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = \'users\'
           AND COLUMN_NAME = \'admin_singleton\''
    );
    $adminSlot->execute();
    if ((int) $adminSlot->fetchColumn() === 0) {
        $pdo->exec(
            'ALTER TABLE users
             ADD COLUMN admin_singleton TINYINT
             GENERATED ALWAYS AS (CASE WHEN is_admin = 1 THEN 1 ELSE NULL END) STORED,
             ADD UNIQUE KEY uq_users_single_admin (admin_singleton)'
        );
    }

    // Xóa nơi lưu token provider theo user từ kiến trúc cũ.
    $column = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = \'provider_accounts\'
           AND COLUMN_NAME = \'access_token\''
    );
    $column->execute();
    $removedProviderTokenColumn = (int) $column->fetchColumn() > 0;
    if ($removedProviderTokenColumn) {
        $pdo->exec('ALTER TABLE provider_accounts DROP COLUMN access_token');
    }

    json_out(200, [
        'success' => true,
        'data' => [
            'adminEmail' => $adminEmail,
            'adminCount' => 1,
            'removedProviderTokenColumn' => $removedProviderTokenColumn,
        ],
    ]);
} catch (Throwable $e) {
    json_out(500, ['success' => false, 'message' => 'Migration thất bại: ' . $e->getMessage()]);
}
