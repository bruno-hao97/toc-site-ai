<?php
declare(strict_types=1);

function gommo_cfg(): array
{
    $cfg = platform_config();
    return [
        'token' => (string) ($cfg['gommo_access_token'] ?? ''),
        'domain' => (string) ($cfg['gommo_domain'] ?? 'vmedia.ai'),
        'project_id' => (string) ($cfg['gommo_project_id'] ?? 'default'),
        'api_base' => rtrim((string) ($cfg['gommo_api_base'] ?? 'https://v2.api.gommo.net'), '/'),
        // Host cho newsfeed / public-videos / me (khác host v2 dùng cho job).
        'auth_base' => rtrim((string) ($cfg['gommo_auth_base'] ?? 'https://api.gommo.net'), '/'),
    ];
}

/** POST form tới host v2 (job) — giữ nguyên hành vi cũ, tự chèn project_id. */
function gommo_post_form(string $path, array $fields): array
{
    $g = gommo_cfg();
    if (!isset($fields['project_id']) || $fields['project_id'] === '') {
        $fields['project_id'] = $g['project_id'];
    }
    return gommo_request_form($g['api_base'], $path, $fields);
}

/**
 * Upload multipart (ảnh/video) qua token admin dùng chung.
 *
 * @param array<string, scalar> $fields
 * @return array<string, mixed>
 */
function gommo_upload_multipart(
    string $path,
    array $fields,
    string $fileField,
    string $tmpPath,
    string $fileName,
    string $mime = ''
): array {
    $g = gommo_cfg();
    if ($g['token'] === '') {
        throw new RuntimeException('Chưa cấu hình gommo_access_token trên server');
    }
    if ($tmpPath === '' || !is_file($tmpPath)) {
        throw new RuntimeException('File upload không hợp lệ');
    }

    $fields['domain'] = $fields['domain'] ?? $g['domain'];
    $fields['project_id'] = $fields['project_id'] ?? $g['project_id'];
    $fields['access_token'] = $g['token'];
    $fields[$fileField] = new CURLFile(
        $tmpPath,
        $mime !== '' ? $mime : (mime_content_type($tmpPath) ?: 'application/octet-stream'),
        $fileName !== '' ? $fileName : basename($tmpPath)
    );

    $url = rtrim($g['api_base'], '/') . $path;
    $ch = curl_init($url);
    if ($ch === false) {
        throw new RuntimeException('curl init failed');
    }
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $fields,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 180,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $g['token'],
            'Accept: application/json',
        ],
    ]);
    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);

    if ($raw === false) {
        throw new RuntimeException('Gommo upload failed: ' . $err);
    }

    $parsed = json_decode($raw, true);
    if (!is_array($parsed)) {
        throw new RuntimeException('Gommo upload response không phải JSON: ' . substr($raw, 0, 200));
    }
    if ($status >= 400 || ($parsed['success'] ?? true) === false) {
        $msg = (string) ($parsed['message'] ?? ('HTTP ' . $status));
        throw new RuntimeException($msg);
    }

    return $parsed;
}

/** POST form tới base tùy ý — luôn chèn access_token dùng chung của admin. */
function gommo_request_form(string $base, string $path, array $fields): array
{
    $g = gommo_cfg();
    if ($g['token'] === '') {
        throw new RuntimeException('Chưa cấu hình gommo_access_token trên server');
    }

    $fields['domain'] = $fields['domain'] ?? $g['domain'];
    $fields['access_token'] = $g['token'];

    $url = rtrim($base, '/') . $path;
    $body = http_build_query(flatten_form_fields($fields));

    $ch = curl_init($url);
    if ($ch === false) {
        throw new RuntimeException('curl init failed');
    }
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 120,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $g['token'],
            'Content-Type: application/x-www-form-urlencoded',
            'Accept: application/json',
        ],
    ]);
    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);

    if ($raw === false) {
        throw new RuntimeException('Gommo request failed: ' . $err);
    }

    $parsed = json_decode($raw, true);
    if (!is_array($parsed)) {
        throw new RuntimeException('Gommo response không phải JSON: ' . substr($raw, 0, 200));
    }
    if ($status >= 400 || ($parsed['success'] ?? true) === false) {
        $msg = (string) ($parsed['message'] ?? ('HTTP ' . $status));
        throw new RuntimeException($msg);
    }

    return $parsed;
}

/** @param mixed $value */
function flatten_form_fields($value, string $prefix = ''): array
{
    $out = [];
    if (!is_array($value)) {
        if ($value !== null && $value !== '') {
            $out[$prefix] = $value;
        }
        return $out;
    }
    foreach ($value as $key => $item) {
        $k = $prefix === '' ? (string) $key : $prefix . '[' . $key . ']';
        if (is_array($item)) {
            $out = array_merge($out, flatten_form_fields($item, $k));
        } elseif ($item !== null && $item !== '') {
            $out[$k] = $item;
        }
    }
    return $out;
}

function extract_provider_job_id(array $envelope): ?string
{
    $data = $envelope['data'] ?? [];
    if (!is_array($data)) {
        return null;
    }
    foreach (['id_base', 'job_id', 'id'] as $key) {
        if (!empty($data[$key])) {
            return (string) $data[$key];
        }
    }
    return null;
}

function extract_result_url(array $envelope): ?string
{
    $data = $envelope['data'] ?? [];
    $raw = $envelope['raw'] ?? [];
    if (!is_array($data)) {
        $data = [];
    }
    if (!is_array($raw)) {
        $raw = [];
    }
    $candidates = [
        $data['result_url'] ?? null,
        $raw['imageInfo']['result_url'] ?? null,
        $raw['videoInfo']['result_url'] ?? null,
        $raw['videoInfo']['url'] ?? null,
    ];
    foreach ($candidates as $url) {
        if (is_string($url) && preg_match('/^https?:\\/\\//i', $url)) {
            return $url;
        }
    }
    return null;
}

/** URL sau upload multipart — bao phủ mọi key Gommo thường trả. */
function extract_upload_url(array $envelope): ?string
{
    $data = $envelope['data'] ?? [];
    $raw = $envelope['raw'] ?? [];
    if (!is_array($data)) {
        $data = [];
    }
    if (!is_array($raw)) {
        $raw = [];
    }
    $imageInfo = is_array($raw['imageInfo'] ?? null) ? $raw['imageInfo'] : [];
    $videoInfo = is_array($raw['videoInfo'] ?? null) ? $raw['videoInfo'] : [];

    $candidates = [
        $data['url'] ?? null,
        $data['result_url'] ?? null,
        $data['image_url'] ?? null,
        $data['video_url'] ?? null,
        $imageInfo['url'] ?? null,
        $imageInfo['result_url'] ?? null,
        $videoInfo['url'] ?? null,
        $videoInfo['result_url'] ?? null,
        $envelope['url'] ?? null,
    ];
    foreach ($candidates as $url) {
        if (is_string($url) && preg_match('/^https?:\\/\\//i', $url)) {
            return $url;
        }
    }

    return extract_result_url($envelope);
}

function extract_status(array $envelope): string
{
    $data = $envelope['data'] ?? [];
    $raw = $envelope['raw'] ?? [];
    if (is_array($data) && !empty($data['status'])) {
        return (string) $data['status'];
    }
    if (is_array($raw)) {
        if (!empty($raw['imageInfo']['status'])) {
            return (string) $raw['imageInfo']['status'];
        }
        if (!empty($raw['videoInfo']['status'])) {
            return (string) $raw['videoInfo']['status'];
        }
    }
    return '';
}

/** Status “thành công” chỉ khi có result_url thật. */
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

/** Status fail từ Gommo gateway / imageInfo. */
function is_job_failed_status(string $status): bool
{
    $s = strtoupper(trim($status));
    if ($s === '') {
        return false;
    }
    static $failed = [
        'FAILED',
        'FAILURE',
        'ERROR',
        'CANCELLED',
        'CANCELED',
        'REJECTED',
        'FAIL',
        'NSFW',
        'BLOCKED',
        'DENIED',
        'TIMEOUT',
        'TIMED_OUT',
        'MEDIA_GENERATION_STATUS_FAILED',
        'MEDIA_GENERATION_STATUS_ERROR',
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

/**
 * Chuẩn hóa status lưu DB: không bao giờ ghi success nếu thiếu result_url.
 */
function normalize_stored_job_status(string $status, ?string $resultUrl): string
{
    if ($resultUrl) {
        return 'success';
    }
    if (is_job_failed_status($status)) {
        return strtoupper(trim($status)) !== '' ? strtoupper(trim($status)) : 'FAILED';
    }
    // Gommo báo SUCCESS/FINISH nhưng chưa có URL → vẫn đang xử lý
    if (is_job_success_claim($status) || $status === '') {
        return 'processing';
    }
    return $status;
}

function image_job_cost(): int
{
    $cfg = platform_config();
    return max(1, (int) ($cfg['image_job_cost'] ?? 10));
}

/** @return list<array<string, mixed>> */
function gommo_models_list(array $envelope): array
{
    $data = $envelope['data'] ?? null;
    if (is_array($data) && isset($data['models']) && is_array($data['models'])) {
        return array_values($data['models']);
    }
    if (is_array($data) && $data !== [] && array_keys($data) === range(0, count($data) - 1)) {
        return $data;
    }
    return [];
}

function gommo_model_id(array $model): string
{
    foreach (['model', 'slug', 'model_id', 'id'] as $key) {
        if (!empty($model[$key]) && is_string($model[$key])) {
            return $model[$key];
        }
        if (!empty($model[$key]) && (is_int($model[$key]) || is_float($model[$key]))) {
            return (string) $model[$key];
        }
    }
    return '';
}

function gommo_fetch_models(string $type): array
{
    $g = gommo_cfg();
    $path = '/ai/models?type=' . rawurlencode($type) . '&domain=' . rawurlencode($g['domain']);
    $envelope = gommo_post_form($path, [
        'type' => $type,
        'domain' => $g['domain'],
    ]);
    return gommo_models_list($envelope);
}

/**
 * Giá theo mode + resolution — cùng logic Studio resolveModelPrice.
 *
 * @param array<string, mixed> $model
 */
function resolve_model_price(array $model, string $mode, string $resolution): int
{
    $eq = static function (?string $a, ?string $b): bool {
        return strtolower((string) ($a ?? '')) === strtolower((string) ($b ?? ''));
    };

    $base = isset($model['price']) ? (int) $model['price'] : 0;
    $prices = $model['prices'] ?? null;
    if (!is_array($prices) || $prices === []) {
        return max(0, $base);
    }

    $hit = null;
    foreach ($prices as $p) {
        if (!is_array($p)) {
            continue;
        }
        $pMode = isset($p['mode']) ? (string) $p['mode'] : null;
        $pRes = isset($p['resolution']) ? (string) $p['resolution'] : null;
        if ($eq($pMode, $mode) && $eq($pRes, $resolution)) {
            $hit = $p;
            break;
        }
    }
    if ($hit === null) {
        foreach ($prices as $p) {
            if (!is_array($p)) {
                continue;
            }
            $pMode = $p['mode'] ?? null;
            $pRes = isset($p['resolution']) ? (string) $p['resolution'] : null;
            if ($pMode === null && $eq($pRes, $resolution)) {
                $hit = $p;
                break;
            }
        }
    }
    if ($hit === null) {
        foreach ($prices as $p) {
            if (!is_array($p)) {
                continue;
            }
            $pMode = isset($p['mode']) ? (string) $p['mode'] : null;
            $pRes = $p['resolution'] ?? null;
            if ($pRes === null && $eq($pMode, $mode)) {
                $hit = $p;
                break;
            }
        }
    }
    if ($hit === null) {
        foreach ($prices as $p) {
            if (!is_array($p)) {
                continue;
            }
            $pRes = isset($p['resolution']) ? (string) $p['resolution'] : null;
            if ($eq($pRes, $resolution)) {
                $hit = $p;
                break;
            }
        }
    }
    if ($hit === null) {
        foreach ($prices as $p) {
            if (!is_array($p)) {
                continue;
            }
            $pMode = isset($p['mode']) ? (string) $p['mode'] : null;
            if ($eq($pMode, $mode)) {
                $hit = $p;
                break;
            }
        }
    }

    if (is_array($hit) && isset($hit['price'])) {
        return max(0, (int) $hit['price']);
    }
    if ($base > 0) {
        return $base;
    }
    $first = $prices[0] ?? null;
    if (is_array($first) && isset($first['price'])) {
        return max(0, (int) $first['price']);
    }
    return 0;
}

/**
 * Giá job từ catalog Gommo. Fallback image_job_cost nếu không tìm thấy.
 *
 * @param array<string, mixed> $fields
 */
function resolve_job_cost(string $type, string $modelId, array $fields): int
{
    $mode = trim((string) ($fields['mode'] ?? ''));
    $resolution = trim((string) ($fields['resolution'] ?? ''));

    try {
        $models = gommo_fetch_models($type);
        $needle = strtolower($modelId);
        foreach ($models as $model) {
            if (!is_array($model)) {
                continue;
            }
            $id = strtolower(gommo_model_id($model));
            if ($id === '' || $id !== $needle) {
                continue;
            }
            $price = resolve_model_price($model, $mode, $resolution);
            if ($price > 0) {
                return $price;
            }
            break;
        }
    } catch (Throwable $e) {
        // fallback below
    }

    return image_job_cost();
}

function refund_user_credits(PDO $pdo, string $userId, int $amount): void
{
    if ($amount <= 0) {
        return;
    }
    $pdo->prepare('UPDATE users SET credits = credits + ? WHERE id = ?')->execute([$amount, $userId]);
}

function charge_user_credits(PDO $pdo, string $userId, int $amount): void
{
    $lock = $pdo->prepare('SELECT credits FROM users WHERE id = ? FOR UPDATE');
    $lock->execute([$userId]);
    $row = $lock->fetch();
    if (!$row) {
        throw new RuntimeException('User không tồn tại');
    }
    if ((int) $row['credits'] < $amount) {
        throw new RuntimeException('Số dư credit không đủ (cần ' . number_format($amount) . ')');
    }
    $pdo->prepare('UPDATE users SET credits = credits - ? WHERE id = ?')->execute([$amount, $userId]);
}
