<?php
declare(strict_types=1);

/**
 * One-time bootstrap: upload qua POST từ deploy/push-bridge-hotfix.ps1
 * GET ?key=...&ping=1 → kiểm tra endpoint sẵn sàng
 * POST ?key=...&file=job-create.php + raw body → ghi đè file trong thư mục bridge
 */
require __DIR__ . '/bootstrap.php';

$key = (string) ($_GET['key'] ?? '');
$expected = (string) (platform_config()['migrate_key'] ?? '');
if ($expected === '' || !hash_equals($expected, $key)) {
    json_out(403, ['success' => false, 'message' => 'Forbidden']);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET' && (string) ($_GET['ping'] ?? '') === '1') {
    json_out(200, ['success' => true, 'data' => ['ready' => true, 'dir' => basename(__DIR__)]]);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    json_out(405, ['success' => false, 'message' => 'Method not allowed']);
}

$file = basename((string) ($_GET['file'] ?? ''));
$allowed = [
    'job-create.php',
    'job-poll.php',
    'job-upload.php',
    'gommo.php',
    'migrate-jobs.php',
    'hotfix-upload.php',
];
if ($file === '' || !in_array($file, $allowed, true)) {
    json_out(400, ['success' => false, 'message' => 'File not allowed', 'allowed' => $allowed]);
}

$content = file_get_contents('php://input');
if ($content === false || strlen($content) < 20) {
    json_out(400, ['success' => false, 'message' => 'Empty body']);
}

$target = __DIR__ . '/' . $file;
if (file_put_contents($target, $content) === false) {
    json_out(500, ['success' => false, 'message' => 'Write failed — kiểm tra quyền thư mục']);
}

json_out(200, [
    'success' => true,
    'data' => [
        'deployed' => $file,
        'bytes' => strlen($content),
        'sha1' => sha1($content),
    ],
]);
