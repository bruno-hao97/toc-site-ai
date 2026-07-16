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
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS platform_jobs (
          id CHAR(36) NOT NULL PRIMARY KEY,
          user_id CHAR(36) NOT NULL,
          job_type VARCHAR(32) NOT NULL,
          model_id VARCHAR(128) NOT NULL,
          provider VARCHAR(32) NOT NULL DEFAULT 'vmedia',
          provider_job_id VARCHAR(128) NULL,
          status VARCHAR(32) NOT NULL DEFAULT 'pending',
          result_url TEXT NULL,
          prompt TEXT NULL,
          meta_json JSON NULL,
          cost_credits INT NOT NULL DEFAULT 0,
          error_message VARCHAR(500) NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          KEY idx_platform_jobs_user (user_id),
          KEY idx_platform_jobs_provider (provider_job_id),
          CONSTRAINT fk_platform_jobs_user FOREIGN KEY (user_id) REFERENCES users(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    json_out(200, ['success' => true, 'data' => ['done' => ['platform_jobs ready']]]);
} catch (Throwable $e) {
    json_out(500, ['success' => false, 'message' => $e->getMessage()]);
}
