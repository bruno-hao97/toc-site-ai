<?php
/**
 * Copy sang config.local.php trên VPS (không commit password thật).
 */
return [
    'db_host' => '127.0.0.1',
    'db_port' => 3306,
    'db_name' => 'sql_pro_agi_vn',
    'db_user' => 'sql_pro_agi_vn',
    'db_password' => 'CHANGE_ME',
    'jwt_secret' => 'CHANGE_ME_SAME_AS_NODE_JWT_SECRET',
    'jwt_expires_seconds' => 60 * 60 * 24 * 7,
    'signup_bonus_credits' => 1000,
    'transfer_min' => 1000,
    'transfer_max' => 20_000_000,
    'admin_emails' => [
        // 'you@gmail.com',
    ],
];
