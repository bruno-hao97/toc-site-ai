<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require __DIR__ . '/gommo.php';

const UPLOAD_BRIDGE_BUILD = '2026-07-20-upload1';
const UPLOAD_MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const UPLOAD_MAX_VIDEO_BYTES = 100 * 1024 * 1024;

function php_upload_err_message(int $code): string
{
    switch ($code) {
        case UPLOAD_ERR_INI_SIZE:
        case UPLOAD_ERR_FORM_SIZE:
            return 'File vượt giới hạn upload của server PHP (post_max_size / upload_max_filesize)';
        case UPLOAD_ERR_PARTIAL:
            return 'File upload bị gián đoạn — thử lại';
        case UPLOAD_ERR_NO_FILE:
            return 'Thiếu file upload';
        case UPLOAD_ERR_NO_TMP_DIR:
            return 'Server thiếu thư mục temp upload';
        case UPLOAD_ERR_CANT_WRITE:
            return 'Server không ghi được file upload';
        case UPLOAD_ERR_EXTENSION:
            return 'Upload bị chặn bởi extension PHP';
        default:
            return 'Lỗi upload (code ' . $code . ')';
    }
}

function upload_mime_allowed(string $mime, string $fileName, string $kind): bool
{
    $mime = strtolower(trim($mime));
    $name = strtolower($fileName);
    if ($kind === 'video') {
        if ($mime !== '' && str_starts_with($mime, 'video/')) {
            return true;
        }
        return (bool) preg_match('/\.(mp4|webm|mov|m4v|mkv)$/', $name);
    }
    if ($mime !== '' && str_starts_with($mime, 'image/')) {
        return true;
    }
    return (bool) preg_match('/\.(jpe?g|png|webp|gif|bmp|heic|heif)$/', $name);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET' && (string) ($_GET['probe'] ?? '') === '1') {
    json_out(200, [
        'success' => true,
        'data' => [
            'bridgeBuild' => UPLOAD_BRIDGE_BUILD,
            'extract_upload_url' => function_exists('extract_upload_url'),
        ],
    ]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(405, ['success' => false, 'message' => 'Method not allowed']);
}

require_bearer_user();

$kind = trim((string) ($_POST['kind'] ?? 'image'));
if ($kind !== 'image' && $kind !== 'video') {
    json_out(400, ['success' => false, 'message' => 'kind phải là image hoặc video']);
}

$file = $_FILES['file'] ?? null;
if (!is_array($file)) {
    json_out(400, ['success' => false, 'message' => 'Thiếu file upload']);
}

$uploadErr = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
if ($uploadErr !== UPLOAD_ERR_OK) {
    json_out(400, ['success' => false, 'message' => php_upload_err_message($uploadErr)]);
}

$tmpPath = (string) ($file['tmp_name'] ?? '');
$fileName = trim((string) ($_POST['file_name'] ?? ($file['name'] ?? '')));
if ($fileName === '') {
    $fileName = $kind === 'video' ? 'video.mp4' : 'image.png';
}
$mime = (string) ($file['type'] ?? '');
$fileSize = (int) ($file['size'] ?? 0);

if ($tmpPath === '' || !is_uploaded_file($tmpPath)) {
    json_out(400, ['success' => false, 'message' => 'File upload không hợp lệ']);
}

if (!upload_mime_allowed($mime, $fileName, $kind)) {
    json_out(400, [
        'success' => false,
        'message' => $kind === 'video'
            ? 'Định dạng video không được hỗ trợ (dùng MP4 / WebM / MOV)'
            : 'Định dạng ảnh không được hỗ trợ (dùng JPG / PNG / WebP)',
    ]);
}

$maxBytes = $kind === 'video' ? UPLOAD_MAX_VIDEO_BYTES : UPLOAD_MAX_IMAGE_BYTES;
if ($fileSize <= 0 || $fileSize > $maxBytes) {
    $limitMb = (int) round($maxBytes / (1024 * 1024));
    json_out(400, [
        'success' => false,
        'message' => $kind === 'video'
            ? "Video quá lớn (tối đa {$limitMb}MB)"
            : "Ảnh quá lớn (tối đa {$limitMb}MB)",
    ]);
}

$path = $kind === 'video' ? '/ai/upload/video' : '/ai/upload/image';
$fileField = $kind === 'video' ? 'video_file' : 'file';
$extra = [
    'file_name' => $fileName,
    'size' => (string) $fileSize,
];

try {
    $envelope = gommo_upload_multipart($path, $extra, $fileField, $tmpPath, $fileName, $mime);
    $url = extract_upload_url($envelope);
    if ($url === null || $url === '') {
        json_out(502, [
            'success' => false,
            'message' => 'Upload thành công nhưng không có URL',
            'bridgeBuild' => UPLOAD_BRIDGE_BUILD,
        ]);
    }
    json_out(200, [
        'success' => true,
        'data' => [
            'url' => $url,
            'envelope' => $envelope,
            'bridgeBuild' => UPLOAD_BRIDGE_BUILD,
        ],
    ]);
} catch (Throwable $e) {
    json_out(500, [
        'success' => false,
        'message' => 'Upload thất bại: ' . $e->getMessage(),
        'bridgeBuild' => UPLOAD_BRIDGE_BUILD,
    ]);
}
