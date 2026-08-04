<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_out(405, ['success' => false, 'message' => 'Method not allowed']);
}

$cfg = platform_config();

json_out(200, [
    'success' => true,
    'data' => [
        'bridgeBuild' => '2026-08-04-auth-session',
        'jwtRefreshEndpoint' => true,
        'jwtExpiresSeconds' => (int) ($cfg['jwt_expires_seconds'] ?? 0),
        'jwtRefreshGraceSeconds' => (int) ($cfg['jwt_refresh_grace_seconds'] ?? 0),
        'friendlyAuthErrors' => true,
    ],
]);
