<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(405, ['success' => false, 'message' => 'Method not allowed']);
}

[$pdo, $user] = require_bearer_user();
$body = read_json_body();

$jobId = trim((string) ($body['platformJobId'] ?? $body['jobId'] ?? $body['id'] ?? ''));
if ($jobId === '') {
    json_out(400, ['success' => false, 'message' => 'Thiếu job id']);
}

$stmt = $pdo->prepare('DELETE FROM platform_jobs WHERE id = ? AND user_id = ?');
$stmt->execute([$jobId, $user['id']]);

if ($stmt->rowCount() < 1) {
    json_out(404, ['success' => false, 'message' => 'Job không tồn tại']);
}

json_out(200, ['success' => true, 'data' => ['deleted' => $jobId]]);
