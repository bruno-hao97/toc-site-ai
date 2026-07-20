<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require __DIR__ . '/gommo.php';

/**
 * Gommo gateway dùng duy nhất token admin phía server.
 * Client chỉ được xác thực bằng JWT platform; access_token do client gửi luôn bị bỏ.
 *
 *   /api/platform/gw.php/v2/ai/models   → https://v2.api.gommo.net/ai/models
 *   /api/platform/gw.php/api/apps/go-mmo/ai/me → https://api.gommo.net/api/apps/go-mmo/ai/me
 *   /api/platform/gw.php/api/v2/chat    → https://api.gommo.net/api/v2/chat
 *   /api/platform/gw.php/ai/...         → https://api.gommo.net/ai/...
 *
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type, Accept');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_bearer_user();

function gw_fail(int $status, string $msg): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'message' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

$pi = $_SERVER['PATH_INFO'] ?? '';
if ($pi === '' || $pi[0] !== '/') {
    gw_fail(400, 'gw: thiếu path (PATH_INFO)');
}

$V2 = 'https://v2.api.gommo.net';
$AUTH = 'https://api.gommo.net';

if (strpos($pi, '/api/apps/go-mmo') === 0) {
    $base = $AUTH;
    $path = $pi;
} elseif (strpos($pi, '/api/v2') === 0) {
    $base = $AUTH;
    $path = $pi;
} elseif (strpos($pi, '/v2/') === 0 || $pi === '/v2') {
    $base = $V2;
    $path = substr($pi, 3);          // bỏ tiền tố /v2 (giống Node stripPrefix)
    if ($path === '' || $path === false) {
        $path = '/';
    }
} elseif (strpos($pi, '/ai') === 0) {
    $base = $AUTH;
    $path = $pi;
} else {
    gw_fail(404, 'gw: route không hỗ trợ ' . $pi);
}

$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$reqBody = file_get_contents('php://input');
if ($reqBody === false) {
    $reqBody = '';
}

$g = gommo_cfg();
if ($g['token'] === '') {
    gw_fail(503, 'Chưa cấu hình token admin trên server');
}

// Query/body tuyệt đối không được phép ghi đè token hoặc tenant admin.
$query = [];
parse_str((string) ($_SERVER['QUERY_STRING'] ?? ''), $query);
unset($query['access_token']);
$query['access_token'] = $g['token'];
$query['domain'] = $g['domain'];
$qs = http_build_query($query);
$url = $base . $path . ($qs !== '' ? ('?' . $qs) : '');

$fwdHeaders = ['Accept: application/json'];
$ct = $_SERVER['CONTENT_TYPE'] ?? ($_SERVER['HTTP_CONTENT_TYPE'] ?? '');
$lowerCt = strtolower($ct);
if (strpos($lowerCt, 'application/x-www-form-urlencoded') !== false) {
    $fields = [];
    parse_str($reqBody, $fields);
    unset($fields['access_token']);
    $fields['access_token'] = $g['token'];
    $fields['domain'] = $g['domain'];
    $reqBody = http_build_query($fields);
    $fwdHeaders[] = 'Content-Type: application/x-www-form-urlencoded';
} elseif (strpos($lowerCt, 'application/json') !== false) {
    $fields = json_decode($reqBody, true);
    if (!is_array($fields)) {
        $fields = [];
    }
    unset($fields['access_token']);
    $fields['access_token'] = $g['token'];
    $fields['domain'] = $g['domain'];
    $reqBody = json_encode($fields, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $fwdHeaders[] = 'Content-Type: application/json';
} elseif ($ct !== '') {
    gw_fail(
        strpos($lowerCt, 'multipart/form-data') !== false ? 400 : 415,
        strpos($lowerCt, 'multipart/form-data') !== false
            ? 'Upload phải đi qua endpoint platform'
            : 'Content-Type không được hỗ trợ'
    );
} elseif ($reqBody !== '') {
    gw_fail(415, 'Content-Type không được hỗ trợ');
}
$fwdHeaders[] = 'Authorization: Bearer ' . $g['token'];

$ch = curl_init($url);
if ($ch === false) {
    gw_fail(500, 'gw: curl init failed');
}

$opts = [
    CURLOPT_CUSTOMREQUEST => $method,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HEADER => false,
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_TIMEOUT => 300,
    CURLOPT_CONNECTTIMEOUT => 20,
    CURLOPT_HTTPHEADER => $fwdHeaders,
    CURLOPT_ENCODING => '', // tự giải nén gzip
];
if ($method !== 'GET' && $method !== 'HEAD') {
    $opts[CURLOPT_POSTFIELDS] = $reqBody;
}
curl_setopt_array($ch, $opts);

$respBody = curl_exec($ch);
if ($respBody === false) {
    $err = curl_error($ch);
    curl_close($ch);
    gw_fail(502, 'gw upstream error: ' . $err);
}

$status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$respCt = (string) curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
curl_close($ch);

http_response_code($status > 0 ? $status : 502);
header('Content-Type: ' . ($respCt !== '' ? $respCt : 'application/json; charset=utf-8'));
echo $respBody;
