<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_out(405, ['success' => false, 'message' => 'Method not allowed']);
}

try {
    [, $user] = require_bearer_user();
    json_out(200, ['success' => true, 'data' => ['user' => user_public($user)]]);
} catch (Throwable $e) {
    json_out(401, ['success' => false, 'message' => $e->getMessage()]);
}
