<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require __DIR__ . '/gommo.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_out(405, ['success' => false, 'message' => 'Method not allowed']);
}

require_bearer_user();

$type = trim((string) ($_GET['type'] ?? 'image'));
if ($type === '' || !preg_match('/^[a-z0-9-]+$/', $type)) {
    json_out(400, ['success' => false, 'message' => 'type không hợp lệ']);
}

try {
    $g = gommo_cfg();
    $path = '/ai/models?type=' . rawurlencode($type) . '&domain=' . rawurlencode($g['domain']);
    $envelope = gommo_post_form($path, [
        'type' => $type,
        'domain' => $g['domain'],
    ]);
    json_out(200, ['success' => true, 'data' => $envelope]);
} catch (Throwable $e) {
    json_out(500, ['success' => false, 'message' => 'Không tải được models: ' . $e->getMessage()]);
}
