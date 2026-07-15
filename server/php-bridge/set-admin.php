<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$key = (string) ($_GET['key'] ?? '');
$expected = (string) ($CONFIG['migrate_key'] ?? '');
if ($expected === '' || !hash_equals($expected, $key)) {
    json_out(403, ['success' => false, 'message' => 'Forbidden']);
}

$email = strtolower(trim((string) ($_GET['email'] ?? '')));
if ($email === '' || strpos($email, '@') === false) {
    json_out(400, ['success' => false, 'message' => 'Thiếu email']);
}

$pdo = db($CONFIG);
$user = find_user_by_email($pdo, $email);
if (!$user) {
    json_out(404, ['success' => false, 'message' => 'User không tồn tại']);
}
$pdo->prepare('UPDATE users SET is_admin = 1 WHERE id = ?')->execute([$user['id']]);
$fresh = find_user_by_id($pdo, $user['id']);
json_out(200, ['success' => true, 'data' => ['user' => user_public($fresh ?: $user)]]);
