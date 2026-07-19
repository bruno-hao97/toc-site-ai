<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require __DIR__ . '/gommo.php';

/**
 * Newsfeed trang chủ cho user thường (đăng nhập bằng account).
 * Dùng chung access_token admin phía server — user không cần token Gommo riêng.
 */

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_out(405, ['success' => false, 'message' => 'Method not allowed']);
}

// Chỉ cần user đăng nhập hợp lệ (không yêu cầu admin).
require_bearer_user();

$limit = max(1, min(50, (int) ($_GET['limit'] ?? 30)));
$privacy = trim((string) ($_GET['privacy'] ?? 'PUBLIC'));
$afterVideoId = trim((string) ($_GET['after_video_id'] ?? ''));
$afterImageId = trim((string) ($_GET['after_image_id'] ?? ''));

try {
    $g = gommo_cfg();
    $fields = [
        'limit' => (string) $limit,
        'project_id' => $g['project_id'],
        'privacy' => $privacy,
    ];
    if ($afterVideoId !== '') {
        $fields['after_video_id'] = $afterVideoId;
    }
    if ($afterImageId !== '') {
        $fields['after_image_id'] = $afterImageId;
    }

    // Envelope Gommo đã có success/data/next_after_video_id/next_after_image_id.
    $envelope = gommo_request_form($g['auth_base'], '/ai/newfeeds', $fields);
    json_out(200, $envelope);
} catch (Throwable $e) {
    json_out(500, ['success' => false, 'message' => 'Không tải được newsfeed: ' . $e->getMessage()]);
}
