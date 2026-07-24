<?php
declare(strict_types=1);

/**
 * Server-side: trừ ví admin nội bộ → cộng user (topup bán credit).
 * Bảo vệ bằng migrate_key / service_key (không dùng JWT browser).
 *
 * POST JSON: { key, to, amount, message?, kind? }
 * kind mặc định: topup_sale
 */

require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(405, ['success' => false, 'message' => 'Method not allowed']);
}

$body = read_json_body();
$cfg = platform_config();
$expected = (string) ($cfg['service_key'] ?? $cfg['migrate_key'] ?? '');
$key = trim((string) ($body['key'] ?? ($_GET['key'] ?? '')));

if ($expected === '' || !hash_equals($expected, $key)) {
    json_out(403, ['success' => false, 'message' => 'Forbidden']);
}

$toQuery = trim((string) ($body['to'] ?? $body['email'] ?? $body['username'] ?? ''));
$amount = (int) floor((float) ($body['amount'] ?? $body['value'] ?? 0));
$message = trim((string) ($body['message'] ?? 'Topup sale'));
$kind = trim((string) ($body['kind'] ?? 'topup_sale'));
if ($kind === '') {
    $kind = 'topup_sale';
}

$max = (int) ($cfg['transfer_max'] ?? 20000000);
if ($toQuery === '') {
    json_out(400, ['success' => false, 'message' => 'Thiếu người nhận']);
}
if ($amount < 1 || $amount > $max) {
    json_out(400, [
        'success' => false,
        'message' => 'Số credit phải từ 1 đến ' . number_format($max),
    ]);
}

$pdo = db();

// Admin duy nhất
$admin = null;
try {
    $stmt = $pdo->query('SELECT * FROM users WHERE is_admin = 1 LIMIT 1');
    $admin = $stmt ? $stmt->fetch(PDO::FETCH_ASSOC) : null;
} catch (Throwable $e) {
    json_out(500, ['success' => false, 'message' => 'Không đọc được admin: ' . $e->getMessage()]);
}
if (!$admin) {
    json_out(500, ['success' => false, 'message' => 'Chưa có tài khoản admin trên hệ thống']);
}

$to = find_user_by_email_or_phone($pdo, $toQuery);
if (!$to) {
    // Thử theo name / email local-part
    $stmt = $pdo->prepare(
        'SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(name) = ? OR email LIKE ? LIMIT 1'
    );
    $q = strtolower($toQuery);
    $stmt->execute([$q, $q, $q . '@%']);
    $to = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
}
if (!$to) {
    json_out(404, ['success' => false, 'message' => 'Không tìm thấy user nhận trên platform']);
}
if ((string) $to['id'] === (string) $admin['id']) {
    json_out(400, ['success' => false, 'message' => 'Không thể topup cho chính admin']);
}

try {
    $pdo->beginTransaction();

    $lockFrom = $pdo->prepare('SELECT id, credits FROM users WHERE id = ? FOR UPDATE');
    $lockFrom->execute([$admin['id']]);
    $fromRow = $lockFrom->fetch();
    if (!$fromRow) {
        throw new RuntimeException('Admin không tồn tại');
    }
    if ((int) $fromRow['credits'] < $amount) {
        $pdo->rollBack();
        json_out(400, [
            'success' => false,
            'message' => 'Ví nội bộ admin không đủ (cần ' . number_format($amount) . ')',
        ]);
    }

    $lockTo = $pdo->prepare('SELECT id FROM users WHERE id = ? FOR UPDATE');
    $lockTo->execute([$to['id']]);
    if (!$lockTo->fetch()) {
        throw new RuntimeException('User nhận không tồn tại');
    }

    $pdo->prepare('UPDATE users SET credits = credits - ? WHERE id = ?')->execute([$amount, $admin['id']]);
    $pdo->prepare('UPDATE users SET credits = credits + ? WHERE id = ?')->execute([$amount, $to['id']]);

    $transferId = uuid_v4();
    $pdo->prepare(
        'INSERT INTO credit_transfers (id, from_user_id, to_user_id, amount, kind, message) VALUES (?, ?, ?, ?, ?, ?)'
    )->execute([$transferId, $admin['id'], $to['id'], $amount, $kind, $message]);

    $pdo->commit();
    $freshTo = find_user_by_id($pdo, (string) $to['id']);
    $freshAdmin = find_user_by_id($pdo, (string) $admin['id']);

    json_out(200, [
        'success' => true,
        'data' => [
            'transferId' => $transferId,
            'amount' => $amount,
            'kind' => $kind,
            'adminCredits' => (int) (($freshAdmin ?: $admin)['credits']),
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
    json_out(500, ['success' => false, 'message' => 'Cộng credit thất bại: ' . $e->getMessage()]);
}
