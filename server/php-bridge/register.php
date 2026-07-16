<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(405, ['success' => false, 'message' => 'Method not allowed']);
}

$body = read_json_body();
$email = strtolower(trim((string) ($body['email'] ?? '')));
$password = (string) ($body['password'] ?? '');
$phone = trim((string) ($body['phone'] ?? ''));
$name = trim((string) ($body['name'] ?? ''));

if ($email === '' || strpos($email, '@') === false) {
    json_out(400, ['success' => false, 'message' => 'Email không hợp lệ']);
}
if (strlen($password) < 6) {
    json_out(400, ['success' => false, 'message' => 'Mật khẩu cần ít nhất 6 ký tự']);
}

try {
    $cfg = platform_config();
    $pdo = db();
    if (find_user_by_email($pdo, $email)) {
        json_out(409, ['success' => false, 'message' => 'Email đã được đăng ký']);
    }

    $id = uuid_v4();
    $hash = password_hash($password, PASSWORD_BCRYPT);
    $credits = (int) ($cfg['signup_bonus_credits'] ?? 0);

    $stmt = $pdo->prepare(
        'INSERT INTO users (id, email, phone, name, password_hash, credits) VALUES (?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $id,
        $email,
        $phone !== '' ? $phone : null,
        $name !== '' ? $name : null,
        $hash,
        $credits,
    ]);

    $user = find_user_by_id($pdo, $id);
    if (!$user) {
        json_out(500, ['success' => false, 'message' => 'Không tạo được tài khoản']);
    }

    json_out(201, [
        'success' => true,
        'data' => [
            'token' => sign_jwt($id),
            'user' => user_public($user),
        ],
    ]);
} catch (Throwable $e) {
    json_out(500, ['success' => false, 'message' => 'Đăng ký thất bại: ' . $e->getMessage()]);
}
