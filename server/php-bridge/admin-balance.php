<?php
declare(strict_types=1);

/**
 * Server-side: đọc số dư ví admin platform.
 * Bảo vệ bằng migrate_key / service_key.
 *
 * GET/POST: ?key=... hoặc JSON { key }
 */

require __DIR__ . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'GET' && $method !== 'POST') {
    json_out(405, ['success' => false, 'message' => 'Method not allowed']);
}

$cfg = platform_config();
$expected = (string) ($cfg['service_key'] ?? $cfg['migrate_key'] ?? '');
$body = $method === 'POST' ? read_json_body() : [];
$key = trim((string) ($body['key'] ?? ($_GET['key'] ?? '')));

if ($expected === '' || !hash_equals($expected, $key)) {
    json_out(403, ['success' => false, 'message' => 'Forbidden']);
}

$pdo = db();
$admin = null;
try {
    $stmt = $pdo->query('SELECT id, email, name, credits FROM users WHERE is_admin = 1 LIMIT 1');
    $admin = $stmt ? $stmt->fetch(PDO::FETCH_ASSOC) : null;
} catch (Throwable $e) {
    json_out(500, ['success' => false, 'message' => 'Không đọc được admin: ' . $e->getMessage()]);
}

if (!$admin) {
    json_out(500, ['success' => false, 'message' => 'Chưa có tài khoản admin trên hệ thống']);
}

json_out(200, [
    'success' => true,
    'data' => [
        'adminId' => (string) $admin['id'],
        'email' => (string) ($admin['email'] ?? ''),
        'name' => (string) ($admin['name'] ?? ''),
        'credits' => (int) ($admin['credits'] ?? 0),
    ],
]);
