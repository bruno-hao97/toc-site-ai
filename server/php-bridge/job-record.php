<?php
declare(strict_types=1);

/**
 * Ghi job đã hoàn thành (vd. TTS từ /ai/audio) vào platform_jobs theo user đăng nhập.
 * Không gọi upstream / không trừ credit — chỉ để thư viện & lịch sử per-user.
 */

require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(405, ['success' => false, 'message' => 'Method not allowed']);
}

[$pdo, $user] = require_bearer_user();
$body = read_json_body();

$type = trim((string) ($body['type'] ?? $body['jobType'] ?? ''));
$modelId = trim((string) ($body['modelId'] ?? $body['model_id'] ?? ''));
$resultUrl = trim((string) ($body['resultUrl'] ?? $body['result_url'] ?? ''));
$prompt = trim((string) ($body['prompt'] ?? ''));
$providerJobId = trim((string) ($body['providerJobId'] ?? $body['provider_job_id'] ?? ''));
$costCredits = max(0, (int) ($body['costCredits'] ?? $body['cost_credits'] ?? 0));
$metaIn = $body['meta'] ?? [];
if (!is_array($metaIn)) {
    $metaIn = [];
}

if ($type === '' || !preg_match('/^[a-z0-9-]+$/', $type)) {
    json_out(400, ['success' => false, 'message' => 'job type không hợp lệ']);
}
if ($resultUrl === '' || !preg_match('#^https?://#i', $resultUrl)) {
    json_out(400, ['success' => false, 'message' => 'Thiếu resultUrl hợp lệ']);
}
if ($modelId === '') {
    $modelId = $type;
}

$meta = [];
foreach ($metaIn as $k => $v) {
    if (!is_string($k) || $k === '') {
        continue;
    }
    if (is_string($v) || is_numeric($v)) {
        $meta[$k] = (string) $v;
    }
}
$metaJson = $meta === [] ? null : json_encode($meta, JSON_UNESCAPED_UNICODE);

$jobId = uuid_v4();

try {
    $pdo->prepare(
        'INSERT INTO platform_jobs (id, user_id, job_type, model_id, provider, provider_job_id, status, result_url, prompt, meta_json, cost_credits)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $jobId,
        $user['id'],
        $type,
        $modelId,
        'vmedia',
        $providerJobId !== '' ? $providerJobId : null,
        'success',
        $resultUrl,
        $prompt !== '' ? $prompt : null,
        $metaJson,
        $costCredits,
    ]);
} catch (Throwable $e) {
    json_out(500, [
        'success' => false,
        'message' => 'Ghi job thất bại: ' . $e->getMessage(),
    ]);
}

json_out(201, [
    'success' => true,
    'data' => [
        'platformJobId' => $jobId,
        'costCredits' => $costCredits,
    ],
]);
