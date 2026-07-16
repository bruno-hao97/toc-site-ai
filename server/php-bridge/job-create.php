<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require __DIR__ . '/gommo.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(405, ['success' => false, 'message' => 'Method not allowed']);
}

[$pdo, $user] = require_bearer_user();
$body = read_json_body();

$type = trim((string) ($body['type'] ?? 'image'));
$modelId = trim((string) ($body['modelId'] ?? $body['model_id'] ?? ''));
$fields = $body['fields'] ?? [];
if (!is_array($fields)) {
    $fields = [];
}

if ($type !== 'image') {
    json_out(400, ['success' => false, 'message' => 'Phase 1 chỉ hỗ trợ job type=image']);
}
if ($modelId === '') {
    json_out(400, ['success' => false, 'message' => 'Thiếu modelId']);
}

// Giá từ catalog Gommo (mode/resolution) — không tin costCredits từ client.
$cost = resolve_job_cost($type, $modelId, $fields);
if ($cost < 1) {
    json_out(400, ['success' => false, 'message' => 'Không xác định được giá model']);
}

$jobId = uuid_v4();

try {
    $pdo->beginTransaction();
    charge_user_credits($pdo, (string) $user['id'], $cost);

    $path = '/ai/jobs/' . rawurlencode($type) . '/' . rawurlencode($modelId);
    $envelope = gommo_post_form($path, $fields);

    $providerJobId = extract_provider_job_id($envelope);
    $resultUrl = extract_result_url($envelope);
    $status = extract_status($envelope);
    if ($resultUrl) {
        $status = 'success';
    } elseif ($status === '') {
        $status = $providerJobId ? 'processing' : 'pending';
    }

    $prompt = trim((string) ($fields['prompt'] ?? ''));
    $meta = [
        'ratio' => isset($fields['ratio']) ? (string) $fields['ratio'] : null,
        'resolution' => isset($fields['resolution']) ? (string) $fields['resolution'] : null,
        'mode' => isset($fields['mode']) ? (string) $fields['mode'] : null,
    ];
    $meta = array_filter($meta, static function ($v) {
        return $v !== null && $v !== '';
    });
    $metaJson = $meta === [] ? null : json_encode($meta, JSON_UNESCAPED_UNICODE);

    $pdo->prepare(
        'INSERT INTO platform_jobs (id, user_id, job_type, model_id, provider, provider_job_id, status, result_url, prompt, meta_json, cost_credits)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $jobId,
        $user['id'],
        $type,
        $modelId,
        'vmedia',
        $providerJobId,
        $status,
        $resultUrl,
        $prompt !== '' ? $prompt : null,
        $metaJson,
        $cost,
    ]);

    $pdo->commit();
    $freshUser = find_user_by_id($pdo, (string) $user['id']);

    json_out(201, [
        'success' => true,
        'data' => [
            'platformJobId' => $jobId,
            'costCredits' => $cost,
            'credits' => (int) (($freshUser ?: $user)['credits']),
            'envelope' => $envelope,
        ],
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    json_out(500, ['success' => false, 'message' => 'Tạo job thất bại: ' . $e->getMessage()]);
}
