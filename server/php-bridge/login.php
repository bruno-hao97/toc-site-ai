<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(405, ['success' => false, 'message' => 'Method not allowed']);
}

$body = read_json_body();
$email = strtolower(trim((string) ($body['email'] ?? '')));
$password = (string) ($body['password'] ?? '');

try {
    $pdo = db();
    $row = find_user_by_email($pdo, $email);
    if (!$row || !password_verify($password, (string) $row['password_hash'])) {
        json_out(401, ['success' => false, 'message' => 'Email hoặc mật khẩu không đúng']);
    }
    $row = sync_admin_flag($pdo, $row);

    json_out(200, [
        'success' => true,
        'data' => [
            'token' => sign_jwt((string) $row['id']),
            'user' => user_public($row),
        ],
    ]);
} catch (Throwable $e) {
    json_out(500, ['success' => false, 'message' => 'Đăng nhập thất bại: ' . $e->getMessage()]);
}
