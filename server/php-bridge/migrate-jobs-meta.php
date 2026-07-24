<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$key = (string) ($_GET['key'] ?? '');
$expected = (string) (platform_config()['migrate_key'] ?? '');
if ($expected === '' || !hash_equals($expected, $key)) {
    json_out(403, ['success' => false, 'message' => 'Forbidden']);
}

try {
    $pdo = db();
    $done = [];

    $hasPrompt = $pdo->query(
        "SELECT COUNT(*) AS c FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_jobs' AND COLUMN_NAME = 'prompt'"
    )->fetch();
    if ((int) ($hasPrompt['c'] ?? 0) === 0) {
        $pdo->exec('ALTER TABLE platform_jobs ADD COLUMN prompt TEXT NULL AFTER result_url');
        $done[] = 'added platform_jobs.prompt';
    } else {
        $done[] = 'platform_jobs.prompt exists';
    }

    $hasMeta = $pdo->query(
        "SELECT COUNT(*) AS c FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_jobs' AND COLUMN_NAME = 'meta_json'"
    )->fetch();
    if ((int) ($hasMeta['c'] ?? 0) === 0) {
        $pdo->exec('ALTER TABLE platform_jobs ADD COLUMN meta_json JSON NULL AFTER prompt');
        $done[] = 'added platform_jobs.meta_json';
    } else {
        $done[] = 'platform_jobs.meta_json exists';
    }

    // Seedance / video trả MEDIA_GENERATION_STATUS_* (>32 ký tự) — widen cột status
    $statusCol = $pdo->query(
        "SELECT CHARACTER_MAXIMUM_LENGTH AS len FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_jobs' AND COLUMN_NAME = 'status'"
    )->fetch();
    $statusLen = (int) ($statusCol['len'] ?? 0);
    if ($statusLen > 0 && $statusLen < 64) {
        $pdo->exec("ALTER TABLE platform_jobs MODIFY status VARCHAR(64) NOT NULL DEFAULT 'pending'");
        $done[] = "widened platform_jobs.status VARCHAR({$statusLen})→VARCHAR(64)";
    } else {
        $done[] = $statusLen > 0
            ? "platform_jobs.status already VARCHAR({$statusLen})"
            : 'platform_jobs.status column missing';
    }

    json_out(200, ['success' => true, 'data' => ['done' => $done]]);
} catch (Throwable $e) {
    json_out(500, ['success' => false, 'message' => $e->getMessage()]);
}
