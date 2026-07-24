<?php
declare(strict_types=1);

/**
 * Trừ / hoàn credit ví nội bộ của user đang đăng nhập.
 * Dùng cho TTS/audio (charge trước khi gọi merchant, refund nếu fail).
 *
 * POST { action: 'charge'|'refund', amount: number, message?: string }
 */

require __DIR__ . '/bootstrap.php';
require __DIR__ . '/gommo.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(405, ['success' => false, 'message' => 'Method not allowed']);
}

[$pdo, $user] = require_bearer_user();
$body = read_json_body();
$action = strtolower(trim((string) ($body['action'] ?? 'charge')));
$amount = (int) floor((float) ($body['amount'] ?? $body['value'] ?? 0));
$message = trim((string) ($body['message'] ?? ''));

if ($action !== 'charge' && $action !== 'refund') {
    json_out(400, ['success' => false, 'message' => 'action phải là charge hoặc refund']);
}
if ($amount < 1) {
    json_out(400, ['success' => false, 'message' => 'Số credit không hợp lệ']);
}
if ($amount > 50_000_000) {
    json_out(400, ['success' => false, 'message' => 'Số credit vượt giới hạn']);
}

try {
    $pdo->beginTransaction();
    if ($action === 'charge') {
        charge_user_credits($pdo, (string) $user['id'], $amount);
    } else {
        refund_user_credits($pdo, (string) $user['id'], $amount);
    }
    $pdo->commit();
    $fresh = find_user_by_id($pdo, (string) $user['id']);
    json_out(200, [
        'success' => true,
        'data' => [
            'action' => $action,
            'amount' => $amount,
            'message' => $message !== '' ? $message : null,
            'credits' => (int) (($fresh ?: $user)['credits']),
        ],
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    $code = (strpos($e->getMessage(), 'không đủ') !== false) ? 400 : 500;
    json_out($code, [
        'success' => false,
        'message' => ($action === 'charge' ? 'Trừ credit thất bại: ' : 'Hoàn credit thất bại: ') . $e->getMessage(),
    ]);
}
