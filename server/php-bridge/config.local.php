<?php
if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === basename(__FILE__)) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Forbidden';
    exit;
}

return [
    'db_host' => '127.0.0.1',
    'db_port' => 3306,
    'db_name' => 'sql_pro_agi_vn',
    'db_user' => 'sql_pro_agi_vn',
    'db_password' => 'a442379c2cda68',
    'jwt_secret' => 'ln-ai-dev-secret-2026-change-in-prod',
    'jwt_expires_seconds' => 60 * 60 * 24 * 7,
    'signup_bonus_credits' => 1000,
    'transfer_min' => 1000,
    'transfer_max' => 20_000_000,
    // Email admin được cấp quyền grant credit (và sync is_admin=1)
    'admin_emails' => [
        // Thêm email admin của bạn, ví dụ: 'you@gmail.com',
    ],
    'migrate_key' => 'toc-migrate-2026',
];
