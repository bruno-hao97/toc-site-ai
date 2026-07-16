<?php
/**
 * Copy sang config.local.php trên VPS (không commit password thật).
 */
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
    'db_password' => 'CHANGE_ME',
    'jwt_secret' => 'CHANGE_ME_SAME_AS_NODE_JWT_SECRET',
    'jwt_expires_seconds' => 604800,
    'signup_bonus_credits' => 1000,
    'transfer_min' => 1000,
    'transfer_max' => 20000000,
    'admin_emails' => [
        'you@gmail.com',
    ],
];
