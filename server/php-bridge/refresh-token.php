<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(405, ['success' => false, 'message' => 'Method not allowed']);
}

$auth = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
if (!preg_match('/^Bearer\s+(\S+)/i', $auth, $m)) {
    json_out(401, ['success' => false, 'message' => 'Vui lòng đăng nhập để tiếp tục']);
}

try {
    $userId = verify_jwt_for_refresh($m[1]);
    $pdo = db();
    $user = find_user_by_id($pdo, $userId);
    if (!$user) {
        json_out(401, ['success' => false, 'message' => 'Tài khoản không tồn tại']);
    }
    $user = sync_admin_flag($pdo, $user);

    json_out(200, [
        'success' => true,
        'data' => [
            'token' => sign_jwt((string) $user['id']),
            'user' => user_public($user),
        ],
    ]);
} catch (RuntimeException $e) {
    json_out(401, ['success' => false, 'message' => jwt_auth_user_message($e->getMessage())]);
} catch (Throwable $e) {
    json_out(500, ['success' => false, 'message' => 'Không làm mới được phiên đăng nhập']);
}
