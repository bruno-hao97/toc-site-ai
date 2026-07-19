<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require __DIR__ . '/gommo.php';

/**
 * Tab "Khám phá" (public videos/images) cho user thường.
 * Dùng chung access_token admin phía server.
 */

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_out(405, ['success' => false, 'message' => 'Method not allowed']);
}

require_bearer_user();

$type = trim((string) ($_GET['type'] ?? 'public_home'));
$publicPrompt = trim((string) ($_GET['public_prompt'] ?? 'false'));
$limit = max(1, min(50, (int) ($_GET['limit'] ?? 30)));
$afterId = trim((string) ($_GET['after_id'] ?? ''));

try {
    $g = gommo_cfg();
    $fields = [
        'type' => $type,
        'public_prompt' => $publicPrompt,
        'limit' => (string) $limit,
    ];
    if ($afterId !== '') {
        $fields['after_id'] = $afterId;
    }

    // Envelope Gommo có success/data/next_after_id (hoặc after_id).
    $envelope = gommo_request_form($g['auth_base'], '/api/apps/go-mmo/ai/public-videos', $fields);
    json_out(200, $envelope);
} catch (Throwable $e) {
    json_out(500, ['success' => false, 'message' => 'Không tải được public videos: ' . $e->getMessage()]);
}
