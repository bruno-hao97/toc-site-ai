<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require __DIR__ . '/gommo.php';

/**
 * Tab "Của tôi" — danh sách video/ảnh của merchant VMedia.
 * Dùng chung access_token admin phía server (cùng pool với vmedia.ai merchant).
 */

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_out(405, ['success' => false, 'message' => 'Method not allowed']);
}

require_bearer_user();

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
