<?php
declare(strict_types=1);

/**
 * Đồng bộ quỹ ví nội bộ admin để khớp đối soát:
 *   admin.credits = max(0, VMedia − Σ credits user khác)
 * → VMedia ≈ Σ ví platform
 *
 * POST + Authorization: Bearer <platform JWT admin>
 * Body JSON tùy chọn: { "confirm": true }
 */

require __DIR__ . '/bootstrap.php';
require __DIR__ . '/gommo.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(405, ['success' => false, 'message' => 'Method not allowed']);
}

try {
    [$pdo, $admin] = require_bearer_user();
} catch (Throwable $e) {
    json_out(401, ['success' => false, 'message' => $e->getMessage()]);
}

if (!user_is_admin($admin)) {
    json_out(403, ['success' => false, 'message' => 'Chỉ admin được đồng bộ quỹ']);
}

$body = read_json_body();
$confirmed = ($body['confirm'] ?? false) === true
    || ($body['confirm'] ?? null) === 1
    || ($body['confirm'] ?? null) === '1';
if (!$confirmed) {
    json_out(400, [
        'success' => false,
        'message' => 'Gửi confirm:true để xác nhận đồng bộ quỹ nội bộ',
    ]);
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
$vmediaCredits = isset($balances['credits_ai']) ? (int) $balances['credits_ai'] : 0;

$adminId = (string) $admin['id'];
$before = (int) ($admin['credits'] ?? 0);

try {
    $pdo->beginTransaction();

    $lock = $pdo->prepare('SELECT id, credits FROM users WHERE id = ? FOR UPDATE');
    $lock->execute([$adminId]);
    $row = $lock->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        throw new RuntimeException('Admin không tồn tại');
    }
    $before = (int) $row['credits'];

    $sumUsers = $pdo->prepare(
        'SELECT COALESCE(SUM(credits), 0) FROM users WHERE id <> ?'
    );
    $sumUsers->execute([$adminId]);
    $usersCredits = (int) ($sumUsers->fetchColumn() ?: 0);

    $target = max(0, $vmediaCredits - $usersCredits);

    $pdo->prepare('UPDATE users SET credits = ? WHERE id = ?')->execute([$target, $adminId]);
    $pdo->commit();

    $fresh = find_user_by_id($pdo, $adminId);
    $after = (int) (($fresh ?: $row)['credits']);
    $sumPlatform = $after + $usersCredits;
    $delta = $vmediaCredits - $sumPlatform;

    json_out(200, [
        'success' => true,
        'data' => [
            'message' => 'Đã đồng bộ ví nội bộ = VMedia − Σ credit user',
            'vmedia_credits' => $vmediaCredits,
            'users_credits' => $usersCredits,
            'platform_credits_before' => $before,
            'platform_credits' => $after,
            'sum_platform_credits' => $sumPlatform,
            'reconcile_delta' => $delta,
            'delta_applied' => $after - $before,
        ],
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    json_out(500, [
        'success' => false,
        'message' => 'Đồng bộ quỹ thất bại: ' . $e->getMessage(),
    ]);
}
