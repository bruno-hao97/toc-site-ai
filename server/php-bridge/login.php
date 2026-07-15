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
    $pdo = db($CONFIG);
    $row = find_user_by_email($pdo, $email);
    if (!$row || !password_verify($password, (string) $row['password_hash'])) {
        json_out(401, ['success' => false, 'message' => 'Email hoặc mật khẩu không đúng']);
    }

    json_out(200, [
        'success' => true,
        'data' => [
            'token' => sign_jwt((string) $row['id'], $CONFIG),
            'user' => user_public($row),
        ],
    ]);
} catch (Throwable $e) {
    json_out(500, ['success' => false, 'message' => 'Đăng nhập thất bại: ' . $e->getMessage()]);
}
