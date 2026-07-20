<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$key = (string) ($_GET['key'] ?? '');
$cfg = platform_config();
$expected = (string) ($cfg['migrate_key'] ?? '');
if ($expected === '' || !hash_equals($expected, $key)) {
    json_out(403, ['success' => false, 'message' => 'Forbidden']);
}

$email = strtolower(trim((string) ($_GET['email'] ?? '')));
if ($email === '' || strpos($email, '@') === false) {
    json_out(400, ['success' => false, 'message' => 'Thiếu email']);
}
if ($email !== configured_admin_email()) {
    json_out(400, ['success' => false, 'message' => 'Email không khớp admin duy nhất trong config']);
}

$pdo = db();
$user = find_user_by_email($pdo, $email);
if (!$user) {
    json_out(404, ['success' => false, 'message' => 'User không tồn tại']);
}
$pdo->beginTransaction();
try {
    $pdo->exec('UPDATE users SET is_admin = 0 WHERE is_admin <> 0');
    $pdo->prepare('UPDATE users SET is_admin = 1 WHERE LOWER(email) = ?')->execute([$email]);
    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    json_out(500, ['success' => false, 'message' => 'Không cập nhật được admin']);
}
$fresh = find_user_by_id($pdo, $user['id']);
json_out(200, ['success' => true, 'data' => ['user' => user_public($fresh ?: $user)]]);
