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

$pollId = is_array($row) ? (string) ($row['provider_job_id'] ?? '') : '';
if ($pollId === '') {
    $pollId = $providerJobId;
}
if ($pollId === '') {
    json_out(400, ['success' => false, 'message' => 'Job chưa có provider_job_id']);
}

try {
    ensure_platform_jobs_refunded_at($pdo);

    $path = '/ai/jobs/' . rawurlencode($pollId) . '?media=' . rawurlencode($media);
    $envelope = gommo_post_form($path, []);

    $resultUrl = extract_result_url($envelope);
    $coverUrl = extract_cover_url($envelope);
    $status = normalize_stored_job_status(extract_status($envelope), $resultUrl);

    $meta = [];
    if ($row && !empty($row['meta_json'])) {
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

    $failed = !$resultUrl && ($status === 'failed' || is_job_failed_status($status));
    $refunded = false;
    $creditsAfter = null;

    if ($row && $failed) {
        // Cập nhật status + hoàn credit trong một transaction (idempotent).
        $pdo->beginTransaction();
        try {
            $pdo->prepare(
                'UPDATE platform_jobs SET status = ?, result_url = ?, meta_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
            )->execute(['failed', $resultUrl, $metaJson, $row['id']]);

            $refunded = try_refund_failed_platform_job($pdo, (string) $row['id'], 'failed');
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
        $fresh = find_user_by_id($pdo, (string) $user['id']);
        $creditsAfter = (int) (($fresh ?: $user)['credits']);
    } elseif ($row) {
        $pdo->prepare(
            'UPDATE platform_jobs SET status = ?, result_url = ?, meta_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        )->execute([$status, $resultUrl, $metaJson, $row['id']]);
    }

    $data = [
        'platformJobId' => $row ? $row['id'] : null,
        'envelope' => $envelope,
        'status' => $failed ? 'failed' : $status,
        'refunded' => $refunded,
        'polledVia' => $row ? 'db+gommo' : 'gommo-orphan',
    ];
    if ($creditsAfter !== null) {
        $data['credits'] = $creditsAfter;
    }

    json_out(200, [
        'success' => true,
        'data' => $data,
    ]);
} catch (Throwable $e) {
    json_out(500, ['success' => false, 'message' => 'Poll job thất bại: ' . $e->getMessage()]);
}
