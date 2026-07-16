<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(405, ['success' => false, 'message' => 'Method not allowed']);
}

[$pdo, $admin] = require_bearer_user();
if (!user_is_admin($admin)) {
    json_out(403, ['success' => false, 'message' => 'Chỉ admin được cấp credit từ quỹ hệ thống']);
}

$body = read_json_body();
$toQuery = trim((string) ($body['to'] ?? $body['email'] ?? $body['username'] ?? ''));
$message = trim((string) ($body['message'] ?? ''));
$amount = (int) floor((float) ($body['amount'] ?? $body['value'] ?? 0));

$cfg = platform_config();
$min = 1;
$max = (int) ($cfg['transfer_max'] ?? 20000000);

if ($toQuery === '') {
    json_out(400, ['success' => false, 'message' => 'Nhập email hoặc SĐT người nhận']);
}
if ($message === '') {
    json_out(400, ['success' => false, 'message' => 'Lời nhắn là bắt buộc']);
}
if ($amount < $min || $amount > $max) {
    json_out(400, [
        'success' => false,
        'message' => 'Số credit phải từ ' . number_format($min) . ' đến ' . number_format($max),
    ]);
}

$to = find_user_by_email_or_phone($pdo, $toQuery);
if (!$to) {
    json_out(404, ['success' => false, 'message' => 'Không tìm thấy người nhận trên hệ thống']);
}

try {
    $pdo->beginTransaction();
    $lockTo = $pdo->prepare('SELECT id FROM users WHERE id = ? FOR UPDATE');
    $lockTo->execute([$to['id']]);
    if (!$lockTo->fetch()) {
        throw new RuntimeException('Người nhận không tồn tại');
    }

    $pdo->prepare('UPDATE users SET credits = credits + ? WHERE id = ?')->execute([$amount, $to['id']]);

    $transferId = uuid_v4();
    $pdo->prepare(
        'INSERT INTO credit_transfers (id, from_user_id, to_user_id, amount, kind, message) VALUES (?, ?, ?, ?, ?, ?)'
    )->execute([$transferId, $admin['id'], $to['id'], $amount, 'admin_grant', $message]);

    $pdo->commit();
    $freshTo = find_user_by_id($pdo, $to['id']);

    json_out(200, [
        'success' => true,
        'data' => [
            'transferId' => $transferId,
            'amount' => $amount,
            'message' => 'Cấp credit thành công',
            'to' => [
                'id' => $to['id'],
                'email' => $to['email'],
                'name' => $to['name'],
                'credits' => (int) (($freshTo ?: $to)['credits']),
            ],
        ],
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    json_out(500, ['success' => false, 'message' => 'Cấp credit thất bại: ' . $e->getMessage()]);
}
