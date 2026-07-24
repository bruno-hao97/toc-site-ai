<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require __DIR__ . '/gommo.php';
require __DIR__ . '/load-job-status-helpers.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(405, ['success' => false, 'message' => 'Method not allowed']);
}

[$pdo, $user] = require_bearer_user();
$body = read_json_body();

$platformJobId = trim((string) ($body['platformJobId'] ?? $body['jobId'] ?? ''));
$providerJobId = trim((string) ($body['providerJobId'] ?? ''));
$media = trim((string) ($body['media'] ?? 'image'));

if ($platformJobId === '' && $providerJobId === '') {
    json_out(400, ['success' => false, 'message' => 'Thiếu job id']);
}

$row = null;
if ($platformJobId !== '') {
    $stmt = $pdo->prepare('SELECT * FROM platform_jobs WHERE id = ? AND user_id = ? LIMIT 1');
    $stmt->execute([$platformJobId, $user['id']]);
    $row = $stmt->fetch() ?: null;
} elseif ($providerJobId !== '') {
    $stmt = $pdo->prepare('SELECT * FROM platform_jobs WHERE provider_job_id = ? AND user_id = ? LIMIT 1');
    $stmt->execute([$providerJobId, $user['id']]);
    $row = $stmt->fetch() ?: null;
}

if (!$row) {
    json_out(404, ['success' => false, 'message' => 'Job không tồn tại']);
}

$pollId = (string) ($row['provider_job_id'] ?? '');
if ($pollId === '') {
    json_out(400, ['success' => false, 'message' => 'Job chưa có provider_job_id']);
}

try {
    $path = '/ai/jobs/' . rawurlencode($pollId) . '?media=' . rawurlencode($media);
    $envelope = gommo_post_form($path, []);

    $resultUrl = extract_result_url($envelope);
    $coverUrl = extract_cover_url($envelope);
    $status = normalize_stored_job_status(extract_status($envelope), $resultUrl);

    $meta = [];
    if (!empty($row['meta_json'])) {
        $decoded = json_decode((string) $row['meta_json'], true);
        if (is_array($decoded)) {
            $meta = $decoded;
        }
    }
    if (is_string($coverUrl) && $coverUrl !== '') {
        $meta['coverUrl'] = $coverUrl;
        $meta['cover_url'] = $coverUrl;
    }
    $metaJson = $meta === [] ? null : json_encode($meta, JSON_UNESCAPED_UNICODE);

    $pdo->prepare(
        'UPDATE platform_jobs SET status = ?, result_url = ?, meta_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    )->execute([$status, $resultUrl, $metaJson, $row['id']]);

    json_out(200, [
        'success' => true,
        'data' => [
            'platformJobId' => $row['id'],
            'envelope' => $envelope,
        ],
    ]);
} catch (Throwable $e) {
    json_out(500, ['success' => false, 'message' => 'Poll job thất bại: ' . $e->getMessage()]);
}
