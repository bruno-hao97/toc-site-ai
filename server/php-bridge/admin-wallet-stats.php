<?php
declare(strict_types=1);

/**
 * Thống kê 2 ví + đối soát admin.
 * GET + Authorization: Bearer <platform JWT>
 *
 * Invariant B: vmedia ≈ sum_platform_credits (± threshold)
 * Sổ A: admin_remaining + transferred + self_used + in_flight ≈ quỹ đã phân bổ
 */

require __DIR__ . '/bootstrap.php';
require __DIR__ . '/gommo.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_out(405, ['success' => false, 'message' => 'Method not allowed']);
}

try {
    [$pdo, $admin] = require_bearer_user();
} catch (Throwable $e) {
    json_out(401, ['success' => false, 'message' => $e->getMessage()]);
}

if (!user_is_admin($admin)) {
    json_out(403, ['success' => false, 'message' => 'Chỉ admin được xem thống kê ví']);
}

$adminId = (string) $admin['id'];
$platformCredits = (int) ($admin['credits'] ?? 0);

ensure_platform_jobs_refunded_at($pdo);

function wallet_sum(PDO $pdo, string $sql, array $params = []): int
{
    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        return (int) ($stmt->fetchColumn() ?: 0);
    } catch (Throwable $ignored) {
        return 0;
    }
}

$sumPlatformCredits = wallet_sum($pdo, 'SELECT COALESCE(SUM(credits), 0) FROM users');
$usersCredits = wallet_sum(
    $pdo,
    'SELECT COALESCE(SUM(credits), 0) FROM users WHERE id <> ?',
    [$adminId]
);

$transferredGrant = wallet_sum(
    $pdo,
    'SELECT COALESCE(SUM(amount), 0) FROM credit_transfers WHERE from_user_id = ? AND kind = \'admin_grant\'',
    [$adminId]
);
$transferredTransfer = wallet_sum(
    $pdo,
    'SELECT COALESCE(SUM(amount), 0) FROM credit_transfers WHERE from_user_id = ? AND kind = \'transfer\'',
    [$adminId]
);
$transferredTopup = wallet_sum(
    $pdo,
    'SELECT COALESCE(SUM(amount), 0) FROM credit_transfers WHERE from_user_id = ? AND kind = \'topup_sale\'',
    [$adminId]
);
$transferredTotal = $transferredGrant + $transferredTransfer + $transferredTopup;

$selfUsed = wallet_sum(
    $pdo,
    "SELECT COALESCE(SUM(cost_credits), 0) FROM platform_jobs
     WHERE user_id = ?
       AND refunded_at IS NULL
       AND status IN ('success', 'completed', 'FINISH', 'finish')",
    [$adminId]
);

$inFlightAdmin = wallet_sum(
    $pdo,
    "SELECT COALESCE(SUM(cost_credits), 0) FROM platform_jobs
     WHERE user_id = ?
       AND refunded_at IS NULL
       AND status IN ('pending', 'processing', 'running', 'queued')",
    [$adminId]
);

$inFlightAll = wallet_sum(
    $pdo,
    "SELECT COALESCE(SUM(cost_credits), 0) FROM platform_jobs
     WHERE refunded_at IS NULL
       AND status IN ('pending', 'processing', 'running', 'queued')"
);

$consumedAll = wallet_sum(
    $pdo,
    "SELECT COALESCE(SUM(cost_credits), 0) FROM platform_jobs
     WHERE refunded_at IS NULL
       AND status IN ('success', 'completed', 'FINISH', 'finish')"
);

$refundedTotal = wallet_sum(
    $pdo,
    'SELECT COALESCE(SUM(cost_credits), 0) FROM platform_jobs WHERE refunded_at IS NOT NULL'
);

$impliedAdminFund = $platformCredits + $transferredTotal + $selfUsed + $inFlightAdmin;

$recent = [];
try {
    $stmt = $pdo->prepare(
        'SELECT t.id, t.amount, t.kind, t.message, t.created_at,
                u.email AS to_email, u.name AS to_name
         FROM credit_transfers t
         LEFT JOIN users u ON u.id = t.to_user_id
         WHERE t.from_user_id = ?
         ORDER BY t.created_at DESC
         LIMIT 30'
    );
    $stmt->execute([$adminId]);
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $recent[] = [
            'id' => (string) $row['id'],
            'amount' => (int) $row['amount'],
            'kind' => (string) $row['kind'],
            'message' => $row['message'] !== null ? (string) $row['message'] : null,
            'created_at' => (string) $row['created_at'],
            'to_email' => $row['to_email'] !== null ? (string) $row['to_email'] : null,
            'to_name' => $row['to_name'] !== null ? (string) $row['to_name'] : null,
        ];
    }
} catch (Throwable $ignored) {
    $recent = [];
}

$vmediaCredits = null;
$vmediaUpdated = null;
$g = gommo_cfg();
if ($g['token'] !== '') {
    $url = rtrim($g['auth_base'], '/') . '/api/apps/go-mmo/ai/me';
    $postBody = http_build_query([
        'access_token' => $g['token'],
        'domain' => $g['domain'],
    ]);
    $ch = curl_init($url);
    if ($ch !== false) {
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $postBody,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $g['token'],
                'Content-Type: application/x-www-form-urlencoded',
                'Accept: application/json',
            ],
        ]);
        $raw = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if (is_string($raw) && $raw !== '') {
            $parsed = json_decode($raw, true);
            if (is_array($parsed) && $status < 400 && ($parsed['success'] ?? true) !== false) {
                $balances = is_array($parsed['balancesInfo'] ?? null) ? $parsed['balancesInfo'] : [];
                $vmediaCredits = isset($balances['credits_ai']) ? (int) $balances['credits_ai'] : 0;
                $vmediaUpdated = isset($balances['updated_time']) ? (int) $balances['updated_time'] : null;
            }
        }
    }
}

$delta = null;
$reconcileOk = null;
$threshold = 1000;
if ($vmediaCredits !== null) {
    $delta = $vmediaCredits - $sumPlatformCredits;
    $reconcileOk = abs($delta) <= $threshold;
}

json_out(200, [
    'success' => true,
    'data' => [
        'platform_credits' => $platformCredits,
        'users_credits' => $usersCredits,
        'sum_platform_credits' => $sumPlatformCredits,
        'vmedia_credits' => $vmediaCredits,
        'vmedia_updated_time' => $vmediaUpdated,
        'reconcile_delta' => $delta,
        'reconcile_ok' => $reconcileOk,
        'reconcile_threshold' => $threshold,
        'transferred_to_users' => $transferredTotal,
        'transferred_grant' => $transferredGrant,
        'transferred_transfer' => $transferredTransfer,
        'transferred_topup' => $transferredTopup,
        'self_used' => $selfUsed,
        'in_flight_admin' => $inFlightAdmin,
        'in_flight_all' => $inFlightAll,
        'consumed_all' => $consumedAll,
        'refunded_total' => $refundedTotal,
        'implied_admin_fund' => $impliedAdminFund,
        'recent_transfers' => $recent,
    ],
]);
