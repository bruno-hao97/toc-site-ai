<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require __DIR__ . '/gommo.php';

/**
 * Thư viện merchant VMedia (toàn bộ job Gommo) — chỉ admin.
 * User thường dùng job-list.php (platform_jobs theo user_id).
 */

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_out(405, ['success' => false, 'message' => 'Method not allowed']);
}

[$pdo, $user] = require_bearer_user();
if (!user_is_admin($user)) {
    json_out(403, [
        'success' => false,
        'message' => 'Chỉ admin được xem thư viện merchant. User dùng job-list theo tài khoản.',
    ]);
}

$type = trim((string) ($_GET['type'] ?? 'video'));
$limit = max(1, min(50, (int) ($_GET['limit'] ?? 30)));
$afterId = trim((string) ($_GET['afterId'] ?? $_GET['after_id'] ?? ''));

if ($type !== 'video' && $type !== 'image') {
    json_out(400, ['success' => false, 'message' => 'type phải là video hoặc image']);
}

try {
    $g = gommo_cfg();
    $path = $type === 'video' ? '/ai/videos' : '/ai/images';
    $fields = [
        'limit' => (string) $limit,
        'order_by' => 'index',
        'sort_by' => 'desc',
        'project_id' => $g['project_id'],
    ];
    if ($afterId !== '') {
        $fields['after_id'] = $afterId;
    }

    $envelope = gommo_request_form($g['auth_base'], $path, $fields);
    json_out(200, $envelope);
} catch (Throwable $e) {
    json_out(500, ['success' => false, 'message' => 'Không tải được thư viện: ' . $e->getMessage()]);
}
