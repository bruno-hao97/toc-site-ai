<?php
declare(strict_types=1);

/**
 * Số dư credits_ai thật trên VMedia — chỉ admin (JWT + admin_emails).
 * GET + Authorization: Bearer <platform JWT>
 */

require __DIR__ . '/bootstrap.php';
require __DIR__ . '/gommo.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_out(405, ['success' => false, 'message' => 'Method not allowed']);
}

try {
    [, $admin] = require_bearer_user();
} catch (Throwable $e) {
    json_out(401, ['success' => false, 'message' => $e->getMessage()]);
}

if (!user_is_admin($admin)) {
    json_out(403, ['success' => false, 'message' => 'Chỉ admin được xem số dư merchant']);
}

$g = gommo_cfg();
if ($g['token'] === '') {
    json_out(503, ['success' => false, 'message' => 'Chưa cấu hình access token merchant trên server']);
}

$url = rtrim($g['auth_base'], '/') . '/api/apps/go-mmo/ai/me';
$postBody = http_build_query([
    'access_token' => $g['token'],
    'domain' => $g['domain'],
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
    json_out(502, ['success' => false, 'message' => 'Upstream lỗi: ' . $err]);
}

$parsed = json_decode($raw, true);
if (!is_array($parsed)) {
    json_out(502, ['success' => false, 'message' => 'Response không phải JSON']);
}
if ($status >= 400 || ($parsed['success'] ?? true) === false) {
    json_out($status >= 400 ? $status : 502, [
        'success' => false,
        'message' => (string) ($parsed['message'] ?? ('HTTP ' . $status)),
    ]);
}

$balances = is_array($parsed['balancesInfo'] ?? null) ? $parsed['balancesInfo'] : [];
$creditsAi = isset($balances['credits_ai']) ? (int) $balances['credits_ai'] : 0;

json_out(200, [
    'success' => true,
    'data' => [
        'credits_ai' => $creditsAi,
        'updated_time' => isset($balances['updated_time']) ? (int) $balances['updated_time'] : null,
    ],
]);
