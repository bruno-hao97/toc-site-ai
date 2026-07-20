<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(405, ['success' => false, 'message' => 'Method not allowed']);
}

[$pdo, $user] = require_bearer_user();
$body = read_json_body();
$currentPassword = (string) ($body['currentPassword'] ?? '');
$newPassword = (string) ($body['newPassword'] ?? '');

if (!password_verify($currentPassword, (string) $user['password_hash'])) {
    json_out(400, ['success' => false, 'message' => 'Mật khẩu hiện tại không đúng']);
}
if (strlen($newPassword) < 6) {
    json_out(400, ['success' => false, 'message' => 'Mật khẩu mới cần ít nhất 6 ký tự']);
}

$hash = password_hash($newPassword, PASSWORD_BCRYPT);
$pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([$hash, $user['id']]);
json_out(200, ['success' => true, 'message' => 'Đổi mật khẩu thành công']);
