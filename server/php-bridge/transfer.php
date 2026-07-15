<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(405, ['success' => false, 'message' => 'Method not allowed']);
}

[$pdo, $from] = require_bearer_user($CONFIG);
$body = read_json_body();
$toQuery = trim((string) ($body['to'] ?? $body['email'] ?? $body['username'] ?? ''));
$message = trim((string) ($body['message'] ?? ''));
$amount = (int) floor((float) ($body['amount'] ?? $body['value'] ?? 0));

$min = (int) ($CONFIG['transfer_min'] ?? 1000);
$max = (int) ($CONFIG['transfer_max'] ?? 20_000_000);

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
if ($to['id'] === $from['id']) {
    json_out(400, ['success' => false, 'message' => 'Không thể tự chuyển cho chính mình']);
}

try {
    $pdo->beginTransaction();

    $lockFrom = $pdo->prepare('SELECT id, credits FROM users WHERE id = ? FOR UPDATE');
    $lockFrom->execute([$from['id']]);
    $fromRow = $lockFrom->fetch();
    if (!$fromRow) {
        throw new RuntimeException('Tài khoản gửi không tồn tại');
    }
    if ((int) $fromRow['credits'] < $amount) {
        $pdo->rollBack();
        json_out(400, ['success' => false, 'message' => 'Số dư credit không đủ']);
    }

    $lockTo = $pdo->prepare('SELECT id, credits FROM users WHERE id = ? FOR UPDATE');
    $lockTo->execute([$to['id']]);
    $toRow = $lockTo->fetch();
    if (!$toRow) {
        throw new RuntimeException('Người nhận không tồn tại');
    }

    $pdo->prepare('UPDATE users SET credits = credits - ? WHERE id = ?')->execute([$amount, $from['id']]);
    $pdo->prepare('UPDATE users SET credits = credits + ? WHERE id = ?')->execute([$amount, $to['id']]);

    $transferId = uuid_v4();
    $pdo->prepare(
        'INSERT INTO credit_transfers (id, from_user_id, to_user_id, amount, kind, message) VALUES (?, ?, ?, ?, ?, ?)'
    )->execute([$transferId, $from['id'], $to['id'], $amount, 'transfer', $message]);

    $pdo->commit();

    $freshFrom = find_user_by_id($pdo, $from['id']);
    $freshTo = find_user_by_id($pdo, $to['id']);

    json_out(200, [
        'success' => true,
        'data' => [
            'transferId' => $transferId,
            'amount' => $amount,
            'message' => 'Chuyển credit thành công',
            'from' => user_public($freshFrom ?: $from),
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
    if (!headers_sent()) {
        json_out(500, ['success' => false, 'message' => 'Chuyển credit thất bại: ' . $e->getMessage()]);
    }
    throw $e;
}
