<?php
declare(strict_types=1);

/**
 * Xác thực Gommo access_token — không cần JWT platform.
 * Dùng cho đăng nhập bằng Token trên frontend.
 *
 * POST JSON: { "access_token": "...", "domain": "..." }
 */

require __DIR__ . '/bootstrap.php';
require __DIR__ . '/gommo.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(405, ['success' => false, 'message' => 'Method not allowed']);
}

$body = read_json_body();
$accessToken = trim((string) ($body['access_token'] ?? $_POST['access_token'] ?? ''));
$domain = trim((string) ($body['domain'] ?? $_POST['domain'] ?? ''));

$g = gommo_cfg();
if ($domain === '') {
    $domain = $g['domain'] !== '' ? $g['domain'] : 'vmedia.ai';
}

if ($accessToken === '') {
    json_out(400, ['success' => false, 'message' => 'Thiếu access_token']);
}

$url = rtrim($g['auth_base'], '/') . '/api/apps/go-mmo/ai/me';
$postBody = http_build_query([
    'access_token' => $accessToken,
    'domain' => $domain,
]);

$ch = curl_init($url);
if ($ch === false) {
    json_out(500, ['success' => false, 'message' => 'curl init failed']);
}
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $postBody,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 60,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . $accessToken,
        'Content-Type: application/x-www-form-urlencoded',
        'Accept: application/json',
    ],
]);
$raw = curl_exec($ch);
$status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err = curl_error($ch);
curl_close($ch);

if ($raw === false) {
    json_out(502, ['success' => false, 'message' => 'Upstream lỗi: ' . $err]);
}

$parsed = json_decode($raw, true);
if (!is_array($parsed)) {
    json_out(502, ['success' => false, 'message' => 'Response không phải JSON']);
}
if ($status >= 400 || ($parsed['success'] ?? true) === false) {
    json_out($status >= 400 ? $status : 401, [
        'success' => false,
        'message' => (string) ($parsed['message'] ?? ('HTTP ' . $status)),
    ]);
}

$userInfo = is_array($parsed['userInfo'] ?? null) ? $parsed['userInfo'] : [];
if (empty($userInfo['id_base']) && empty($userInfo['email'])) {
    json_out(401, ['success' => false, 'message' => 'Token hợp lệ nhưng thiếu userInfo']);
}

json_out(200, [
    'success' => true,
    'data' => $parsed,
]);
