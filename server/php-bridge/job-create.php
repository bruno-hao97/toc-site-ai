<?php
declare(strict_types=1);

const JOB_CREATE_BRIDGE_BUILD = '2026-07-21-admin-vmedia';

require __DIR__ . '/bootstrap.php';
require __DIR__ . '/gommo.php';

// --- inline status helpers (1 file upload, không cần file phụ) ---
if (!function_exists('is_job_success_claim')) {
    function is_job_success_claim(string $status): bool
    {
        $s = strtoupper(trim($status));
        if ($s === '') {
            return false;
        }
        return $s === 'SUCCESS'
            || $s === 'SUCCEEDED'
            || $s === 'DONE'
            || $s === 'COMPLETED'
            || $s === 'FINISH'
            || $s === 'FINISHED'
            || strpos($s, 'SUCCESS') === 0;
    }
}
if (!function_exists('is_job_failed_status')) {
    function is_job_failed_status(string $status): bool
    {
        $s = strtoupper(trim($status));
        if ($s === '') {
            return false;
        }
        static $failed = [
            'FAILED', 'FAILURE', 'ERROR', 'CANCELLED', 'CANCELED', 'REJECTED', 'FAIL',
            'NSFW', 'BLOCKED', 'DENIED', 'TIMEOUT', 'TIMED_OUT',
            'MEDIA_GENERATION_STATUS_FAILED', 'MEDIA_GENERATION_STATUS_ERROR',
            'MEDIA_GENERATION_STATUS_CANCELLED',
        ];
        if (in_array($s, $failed, true)) {
            return true;
        }
        if (
            strpos($s, 'PENDING') === 0
            || strpos($s, 'SUCCESS') === 0
            || strpos($s, 'PROCESS') === 0
            || strpos($s, 'ACTIVE') !== false
            || strpos($s, 'QUEUE') !== false
            || $s === 'RUNNING'
            || $s === 'FINISH'
            || $s === 'FINISHED'
            || $s === 'DONE'
            || $s === 'COMPLETED'
        ) {
            return false;
        }
        if (
            strpos($s, 'FAIL') !== false
            || strpos($s, 'ERROR') !== false
            || strpos($s, 'REJECT') !== false
            || strpos($s, 'CANCEL') !== false
            || strpos($s, 'DENIED') !== false
            || strpos($s, 'BLOCK') !== false
            || strpos($s, 'TIMEOUT') !== false
        ) {
            return true;
        }
        return false;
    }
}
if (!function_exists('normalize_stored_job_status')) {
    function normalize_stored_job_status(string $status, ?string $resultUrl): string
    {
        if ($resultUrl) {
            return 'success';
        }
        if (is_job_failed_status($status)) {
            return strtoupper(trim($status)) !== '' ? strtoupper(trim($status)) : 'FAILED';
        }
        if (is_job_success_claim($status) || $status === '') {
            return 'processing';
        }
        return $status;
    }
}

// Kiểm tra deploy: GET /api/platform/job-create.php?probe=1
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET' && (string) ($_GET['probe'] ?? '') === '1') {
    json_out(200, [
        'success' => true,
        'data' => [
            'bridgeBuild' => JOB_CREATE_BRIDGE_BUILD,
            'normalize_stored_job_status' => function_exists('normalize_stored_job_status'),
            'file' => basename(__FILE__),
        ],
    ]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(405, [
        'success' => false,
        'message' => 'Method not allowed',
        'bridgeBuild' => JOB_CREATE_BRIDGE_BUILD,
    ]);
}
[$pdo, $user] = require_bearer_user();
$body = read_json_body();

$type = trim((string) ($body['type'] ?? 'image'));
$modelId = trim((string) ($body['modelId'] ?? $body['model_id'] ?? ''));
$fields = $body['fields'] ?? [];
if (!is_array($fields)) {
    $fields = [];
}

if ($type === '' || !preg_match('/^[a-z0-9-]+$/', $type)) {
    json_out(400, ['success' => false, 'message' => 'job type không hợp lệ']);
}
if ($modelId === '') {
    json_out(400, ['success' => false, 'message' => 'Thiếu modelId']);
}

// Giá từ catalog Gommo (mode/resolution/duration) — không tin costCredits từ client.
$cost = resolve_job_cost($type, $modelId, $fields);
if ($cost < 1) {
    json_out(400, ['success' => false, 'message' => 'Không xác định được giá model']);
}

$jobId = uuid_v4();
$isAdmin = user_is_admin($user);

try {
    $pdo->beginTransaction();
    // Admin dùng token merchant VMedia — không trừ credit nội bộ platform.
    if (!$isAdmin) {
        charge_user_credits($pdo, (string) $user['id'], $cost);
    }

    $path = '/ai/jobs/' . rawurlencode($type) . '/' . rawurlencode($modelId);
    $envelope = gommo_post_form($path, $fields);

    $providerJobId = extract_provider_job_id($envelope);
    $resultUrl = extract_result_url($envelope);
    $coverUrl = extract_cover_url($envelope);
    $status = normalize_stored_job_status(extract_status($envelope), $resultUrl);
    if ($status === 'processing' && !$providerJobId && !$resultUrl) {
        $status = 'pending';
    }

    $prompt = trim((string) ($fields['prompt'] ?? ''));
    $meta = [
        'ratio' => isset($fields['ratio']) ? (string) $fields['ratio'] : null,
        'resolution' => isset($fields['resolution']) ? (string) $fields['resolution'] : null,
        'mode' => isset($fields['mode']) ? (string) $fields['mode'] : null,
        'duration' => isset($fields['duration']) ? (string) $fields['duration'] : null,
    ];
    if (is_string($coverUrl) && $coverUrl !== '') {
        $meta['coverUrl'] = $coverUrl;
        $meta['cover_url'] = $coverUrl;
    }
    $meta = array_filter($meta, static function ($v) {
        return $v !== null && $v !== '';
    });
    $metaJson = $meta === [] ? null : json_encode($meta, JSON_UNESCAPED_UNICODE);

    // Create đã fail ngay → hoàn credit trong cùng transaction.
    $alreadyFailed = !$resultUrl && is_job_failed_status($status);
    if ($alreadyFailed) {
        if (!$isAdmin) {
            refund_user_credits($pdo, (string) $user['id'], $cost);
        }
        $status = $status !== '' && $status !== 'processing' ? $status : 'FAILED';
    }

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

    if ($alreadyFailed) {
        try {
            $pdo->prepare(
                'UPDATE platform_jobs SET refunded_at = CURRENT_TIMESTAMP WHERE id = ? AND refunded_at IS NULL'
            )->execute([$jobId]);
        } catch (Throwable $ignored) {
            // Cột refunded_at có thể chưa migrate — bỏ qua.
        }
    }

    $pdo->commit();
    $freshUser = find_user_by_id($pdo, (string) $user['id']);

    json_out(201, [
        'success' => true,
        'data' => [
            'platformJobId' => $jobId,
            'costCredits' => $cost,
            'credits' => (int) (($freshUser ?: $user)['credits']),
            'envelope' => $envelope,
            'bridgeVersion' => JOB_CREATE_BRIDGE_BUILD,
        ],
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    json_out(500, [
        'success' => false,
        'message' => 'Tạo job thất bại: ' . $e->getMessage(),
        'bridgeBuild' => JOB_CREATE_BRIDGE_BUILD,
    ]);
}
