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
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS platform_jobs (
          id CHAR(36) NOT NULL PRIMARY KEY,
          user_id CHAR(36) NOT NULL,
          job_type VARCHAR(32) NOT NULL,
          model_id VARCHAR(128) NOT NULL,
          provider VARCHAR(32) NOT NULL DEFAULT 'vmedia',
          provider_job_id VARCHAR(128) NULL,
          status VARCHAR(64) NOT NULL DEFAULT 'pending',
          result_url TEXT NULL,
          prompt TEXT NULL,
          meta_json JSON NULL,
          cost_credits INT NOT NULL DEFAULT 0,
          refunded_at TIMESTAMP NULL DEFAULT NULL,
          error_message VARCHAR(500) NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          KEY idx_platform_jobs_user (user_id),
          KEY idx_platform_jobs_provider (provider_job_id),
          CONSTRAINT fk_platform_jobs_user FOREIGN KEY (user_id) REFERENCES users(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $done[] = 'platform_jobs ready';

    $col = $pdo->query(
        "SELECT COUNT(*) FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'platform_jobs'
           AND COLUMN_NAME = 'refunded_at'"
    );
    if ($col && (int) $col->fetchColumn() === 0) {
        $pdo->exec('ALTER TABLE platform_jobs ADD COLUMN refunded_at TIMESTAMP NULL DEFAULT NULL AFTER cost_credits');
        $done[] = 'added platform_jobs.refunded_at';
    } else {
        $done[] = 'platform_jobs.refunded_at exists';
    }

    json_out(200, ['success' => true, 'data' => ['done' => $done]]);
} catch (Throwable $e) {
    json_out(500, ['success' => false, 'message' => $e->getMessage()]);
}

// Deploy hotfix: POST ?key=...&deploy=job-create.php + raw body
$deployFile = basename((string) ($_GET['deploy'] ?? ''));
if ($deployFile !== '' && ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    $allowed = [
        'job-create.php',
        'job-poll.php',
        'job-upload.php',
        'gommo.php',
        'migrate-jobs.php',
        'hotfix-upload.php',
    ];
    if (!in_array($deployFile, $allowed, true)) {
        json_out(400, ['success' => false, 'message' => 'File not allowed', 'allowed' => $allowed]);
    }
    $content = file_get_contents('php://input');
    if ($content === false || strlen($content) < 20) {
        json_out(400, ['success' => false, 'message' => 'Empty body']);
    }
    $target = __DIR__ . '/' . $deployFile;
    if (file_put_contents($target, $content) === false) {
        json_out(500, ['success' => false, 'message' => 'Write failed']);
    }
    json_out(200, [
        'success' => true,
        'data' => [
            'deployed' => $deployFile,
            'bytes' => strlen($content),
            'sha1' => sha1($content),
        ],
    ]);
}
