<?php
declare(strict_types=1);

/**
 * Chuyển P2P đã tắt — chỉ admin cấp credit qua grant.php.
 */

require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(405, ['success' => false, 'message' => 'Method not allowed']);
}

require_bearer_user();
json_out(403, [
    'success' => false,
    'message' => 'Chuyển credit giữa user đã tắt. Chỉ admin cấp credit qua grant.',
]);
