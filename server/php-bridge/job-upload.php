<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require __DIR__ . '/gommo.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(405, ['success' => false, 'message' => 'Method not allowed']);
}

require_bearer_user();

$kind = trim((string) ($_POST['kind'] ?? 'image'));
if ($kind !== 'image' && $kind !== 'video') {
    json_out(400, ['success' => false, 'message' => 'kind phải là image hoặc video']);
}

$file = $_FILES['file'] ?? null;
if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    json_out(400, ['success' => false, 'message' => 'Thiếu file upload']);
}

$tmpPath = (string) ($file['tmp_name'] ?? '');
$fileName = (string) ($file['name'] ?? ($kind === 'video' ? 'video.mp4' : 'image.png'));
$mime = (string) ($file['type'] ?? '');
if ($tmpPath === '' || !is_uploaded_file($tmpPath)) {
    json_out(400, ['success' => false, 'message' => 'File upload không hợp lệ']);
}

$path = $kind === 'video' ? '/ai/upload/video' : '/ai/upload/image';
$fileField = $kind === 'video' ? 'video_file' : 'file';
$extra = $kind === 'image'
    ? [
        'file_name' => $fileName,
        'size' => (string) ((int) ($file['size'] ?? 0)),
    ]
    : [];

try {
    $envelope = gommo_upload_multipart($path, $extra, $fileField, $tmpPath, $fileName, $mime);
    $data = is_array($envelope['data'] ?? null) ? $envelope['data'] : [];
    $url = (string) (
        $data['url']
        ?? $data['result_url']
        ?? $data['image_url']
        ?? $data['video_url']
        ?? ($envelope['url'] ?? '')
    );
    if ($url === '') {
        json_out(502, ['success' => false, 'message' => 'Upload thành công nhưng không có URL']);
    }
    json_out(200, [
        'success' => true,
        'data' => [
            'url' => $url,
            'envelope' => $envelope,
        ],
    ]);
} catch (Throwable $e) {
    json_out(500, ['success' => false, 'message' => 'Upload thất bại: ' . $e->getMessage()]);
}
