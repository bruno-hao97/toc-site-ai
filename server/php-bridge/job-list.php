<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_out(405, ['success' => false, 'message' => 'Method not allowed']);
}

[$pdo, $user] = require_bearer_user();

$type = trim((string) ($_GET['type'] ?? 'image'));
$limit = max(1, min(50, (int) ($_GET['limit'] ?? 30)));
$afterId = trim((string) ($_GET['afterId'] ?? $_GET['after_id'] ?? ''));

if ($type === '') {
    json_out(400, ['success' => false, 'message' => 'Thiếu type']);
}

// Chỉ job của chính user đăng nhập (admin xem merchant qua mine-media.php).
$params = [(string) $user['id'], $type];
$sql = 'SELECT id, user_id, job_type, model_id, provider_job_id, status, result_url, prompt, meta_json,
               cost_credits, created_at, updated_at
        FROM platform_jobs
        WHERE user_id = ? AND job_type = ?';

if ($afterId !== '') {
    $cur = $pdo->prepare(
        'SELECT created_at, id FROM platform_jobs WHERE id = ? AND user_id = ? LIMIT 1'
    );
    $cur->execute([$afterId, $user['id']]);
    $cursor = $cur->fetch();
    if ($cursor) {
        $sql .= ' AND (created_at < ? OR (created_at = ? AND id < ?))';
        $params[] = $cursor['created_at'];
        $params[] = $cursor['created_at'];
        $params[] = $cursor['id'];
    }
}

$sql .= ' ORDER BY created_at DESC, id DESC LIMIT ' . ($limit + 1);

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();

$hasMore = count($rows) > $limit;
if ($hasMore) {
    $rows = array_slice($rows, 0, $limit);
}

$items = [];
foreach ($rows as $row) {
    $meta = [];
    if (!empty($row['meta_json'])) {
        $decoded = json_decode((string) $row['meta_json'], true);
        if (is_array($decoded)) {
            $meta = $decoded;
        }
    }
    $createdTs = strtotime((string) $row['created_at']);
    $items[] = [
        'id' => $row['id'],
        'providerJobId' => $row['provider_job_id'],
        'jobType' => $row['job_type'],
        'modelId' => $row['model_id'],
        'status' => $row['status'],
        'resultUrl' => $row['result_url'],
        'prompt' => $row['prompt'] ?? ($meta['prompt'] ?? null),
        'ratio' => $meta['ratio'] ?? null,
        'resolution' => $meta['resolution'] ?? null,
        'mode' => $meta['mode'] ?? null,
        'costCredits' => (int) ($row['cost_credits'] ?? 0),
        'createdAt' => $row['created_at'],
        'createdTime' => $createdTs !== false ? $createdTs : null,
    ];
}

$nextAfterId = '';
if ($hasMore && $items !== []) {
    $nextAfterId = (string) $items[count($items) - 1]['id'];
}

json_out(200, [
    'success' => true,
    'data' => [
        'items' => $items,
        'nextAfterId' => $nextAfterId,
    ],
]);
