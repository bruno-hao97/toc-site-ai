<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require __DIR__ . '/gommo.php';

/**
 * Thư viện merchant VMedia (toàn bộ job Gommo) — chỉ admin.
 * User thường dùng job-list.php (platform_jobs theo user_id).
 * Response gắn thêm platform_job_id (UUID) khi có bản ghi trong platform_jobs.
 */

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_out(405, ['success' => false, 'message' => 'Method not allowed']);
}

[$pdo, $user] = require_bearer_user();
if (!user_is_admin($user)) {
    json_out(403, [
        'success' => false,
        'message' => 'Chỉ admin được xem thư viện merchant. User dùng job-list theo tài khoản.',
    ]);
}

$type = trim((string) ($_GET['type'] ?? 'video'));
$limit = max(1, min(50, (int) ($_GET['limit'] ?? 30)));
$afterId = trim((string) ($_GET['afterId'] ?? $_GET['after_id'] ?? ''));

if ($type !== 'video' && $type !== 'image') {
    json_out(400, ['success' => false, 'message' => 'type phải là video hoặc image']);
}

try {
    $g = gommo_cfg();
    $path = $type === 'video' ? '/ai/videos' : '/ai/images';
    $fields = [
        'limit' => (string) $limit,
        'order_by' => 'index',
        'sort_by' => 'desc',
        'project_id' => $g['project_id'],
    ];
    if ($afterId !== '') {
        $fields['after_id'] = $afterId;
    }

    $envelope = gommo_request_form($g['auth_base'], $path, $fields);
    // Gắn platform_jobs.id (UUID) theo provider_job_id để admin/user cùng thấy một ID.
    $envelope = attach_platform_job_ids($pdo, $envelope);
    json_out(200, $envelope);
} catch (Throwable $e) {
    json_out(500, ['success' => false, 'message' => 'Không tải được thư viện: ' . $e->getMessage()]);
}

/**
 * @param array<string, mixed> $envelope
 * @return array<string, mixed>
 */
function attach_platform_job_ids(PDO $pdo, array $envelope): array
{
    $data = $envelope['data'] ?? null;
    if (!is_array($data) || $data === []) {
        return $envelope;
    }

    $providerIds = [];
    foreach ($data as $item) {
        if (!is_array($item)) {
            continue;
        }
        $pid = trim((string) ($item['id_base'] ?? ''));
        if ($pid !== '') {
            $providerIds[$pid] = true;
        }
    }
    $providerIds = array_keys($providerIds);
    if ($providerIds === []) {
        return $envelope;
    }

    $placeholders = implode(',', array_fill(0, count($providerIds), '?'));
    $stmt = $pdo->prepare(
        "SELECT id, provider_job_id
         FROM platform_jobs
         WHERE provider_job_id IN ($placeholders)
         ORDER BY created_at DESC"
    );
    $stmt->execute($providerIds);
    $map = [];
    foreach ($stmt->fetchAll() as $row) {
        $key = (string) ($row['provider_job_id'] ?? '');
        if ($key === '' || isset($map[$key])) {
            continue;
        }
        $map[$key] = (string) $row['id'];
    }

    foreach ($data as &$item) {
        if (!is_array($item)) {
            continue;
        }
        $pid = trim((string) ($item['id_base'] ?? ''));
        if ($pid !== '' && isset($map[$pid])) {
            $item['platform_job_id'] = $map[$pid];
        }
    }
    unset($item);

    $envelope['data'] = $data;
    return $envelope;
}
