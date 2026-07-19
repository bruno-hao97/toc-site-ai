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
    'jwt_expires_seconds' => 604800,
    'signup_bonus_credits' => 1000,
    'transfer_min' => 1000,
    'transfer_max' => 20000000,
    'admin_emails' => [
        'admin@gmail.com',
    ],
    'migrate_key' => 'toc-migrate-2026',
    'gommo_access_token' => 'k1mfUEylQJwxVmp4tbArw/IkHm3/N67jFYI5h9Obbxi8k2nnPQxQRVprePVZSTT1iio409XZ8kQYv4mzY2g94JYv6J/utyr996ldQYju2rexrhmItbcm8Uz0sKItMGSRmCQt4w6ryKxs5F6oJZyxNmbSvRH0TQTIQUC9SUDjY+wNH1hzTWg/XmUHeGk6dIqVB0u7CvdeaThDTVh7m4lijg==',
    'gommo_domain' => 'vmedia.ai',
    'gommo_project_id' => 'default',
    'gommo_api_base' => 'https://v2.api.gommo.net',
    'gommo_auth_base' => 'https://api.gommo.net',
    'image_job_cost' => 10,
];
