<?php
/**
 * Platform auth API — chạy trên cùng VPS với MySQL (localhost).
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$configFile = __DIR__ . '/config.local.php';
if (!is_file($configFile)) {
    http_response_code(503);
    echo json_encode(['success' => false, 'message' => 'Thiếu config.local.php']);
    exit;
}

$loaded = require $configFile;
if (!is_array($loaded)) {
    http_response_code(503);
    echo json_encode(['success' => false, 'message' => 'config.local.php phải return array']);
    exit;
}

$GLOBALS['PLATFORM_CONFIG'] = $loaded;

function platform_config(): array
{
    $cfg = $GLOBALS['PLATFORM_CONFIG'] ?? null;
    if (!is_array($cfg)) {
        throw new RuntimeException('Platform config chưa được load');
    }
    return $cfg;
}

function json_out(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    $cfg = platform_config();
    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        $cfg['db_host'],
        (int) $cfg['db_port'],
        $cfg['db_name']
    );
    $pdo = new PDO($dsn, $cfg['db_user'], $cfg['db_password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    return $pdo;
}

function read_json_body(): array
{
    $raw = file_get_contents('php://input') ?: '';
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function b64url_encode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function b64url_decode(string $data): string
{
    $remainder = strlen($data) % 4;
    if ($remainder) {
        $data .= str_repeat('=', 4 - $remainder);
    }
    return base64_decode(strtr($data, '-_', '+/')) ?: '';
}

function sign_jwt(string $userId): string
{
    $cfg = platform_config();
    $header = b64url_encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT'], JSON_UNESCAPED_SLASHES));
    $now = time();
    $payload = b64url_encode(json_encode([
        'sub' => $userId,
        'iat' => $now,
        'exp' => $now + (int) $cfg['jwt_expires_seconds'],
    ], JSON_UNESCAPED_SLASHES));
    $sig = b64url_encode(hash_hmac('sha256', $header . '.' . $payload, $cfg['jwt_secret'], true));
    return $header . '.' . $payload . '.' . $sig;
}

function verify_jwt(string $token): string
{
    $cfg = platform_config();
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        throw new RuntimeException('Token không hợp lệ');
    }
    [$header, $payload, $sig] = $parts;
    $expected = b64url_encode(hash_hmac('sha256', $header . '.' . $payload, $cfg['jwt_secret'], true));
    if (!hash_equals($expected, $sig)) {
        throw new RuntimeException('Token không hợp lệ');
    }
    $data = json_decode(b64url_decode($payload), true);
    if (!is_array($data) || empty($data['sub'])) {
        throw new RuntimeException('Token không hợp lệ');
    }
    if (!empty($data['exp']) && time() >= (int) $data['exp']) {
        throw new RuntimeException('Token đã hết hạn');
    }
    return (string) $data['sub'];
}

function user_public(array $row): array
{
    return [
        'id' => $row['id'],
        'email' => $row['email'],
        'phone' => $row['phone'],
        'name' => $row['name'],
        'credits' => (int) $row['credits'],
        'isAdmin' => !empty($row['is_admin']),
        'createdAt' => date('c', strtotime((string) $row['created_at'])),
    ];
}

function find_user_by_email(PDO $pdo, string $email): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function find_user_by_id(PDO $pdo, string $id): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function find_user_by_email_or_phone(PDO $pdo, string $query): ?array
{
    $q = trim($query);
    if ($q === '') {
        return null;
    }
    if (strpos($q, '@') !== false) {
        return find_user_by_email($pdo, strtolower($q));
    }

    // SĐT, email đúng chuỗi, name, hoặc phần trước @ của email (vd: user2 → user2@…)
    $stmt = $pdo->prepare(
        'SELECT * FROM users
         WHERE phone = ?
            OR email = ?
            OR LOWER(COALESCE(name, \'\')) = ?
            OR email LIKE ?
         ORDER BY
           CASE
             WHEN phone = ? THEN 0
             WHEN email = ? THEN 1
             WHEN LOWER(COALESCE(name, \'\')) = ? THEN 2
             ELSE 3
           END
         LIMIT 1'
    );
    $lower = strtolower($q);
    $like = $lower . '@%';
    $stmt->execute([$q, $lower, $lower, $like, $q, $lower, $lower]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function require_bearer_user(): array
{
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if (!preg_match('/^Bearer\s+(\S+)/i', $auth, $m)) {
        json_out(401, ['success' => false, 'message' => 'Thiếu token đăng nhập']);
    }
    $userId = verify_jwt($m[1]);
    $pdo = db();
    $user = find_user_by_id($pdo, $userId);
    if (!$user) {
        json_out(401, ['success' => false, 'message' => 'Tài khoản không tồn tại']);
    }
    return [$pdo, sync_admin_flag($pdo, $user)];
}

function sync_admin_flag(PDO $pdo, array $user): array
{
    $cfg = platform_config();
    $emails = $cfg['admin_emails'] ?? [];
    if (!is_array($emails)) {
        return $user;
    }
    $emails = array_map(static function ($e) {
        return strtolower(trim((string) $e));
    }, $emails);
    $shouldAdmin = in_array(strtolower((string) $user['email']), $emails, true);
    $isAdmin = !empty($user['is_admin']);
    if ($shouldAdmin && !$isAdmin) {
        $stmt = $pdo->prepare('UPDATE users SET is_admin = 1 WHERE id = ?');
        $stmt->execute([$user['id']]);
        $user['is_admin'] = 1;
    }
    return $user;
}

function user_is_admin(array $user): bool
{
    if (!empty($user['is_admin'])) {
        return true;
    }
    $cfg = platform_config();
    $emails = $cfg['admin_emails'] ?? [];
    if (!is_array($emails)) {
        return false;
    }
    foreach ($emails as $e) {
        if (strtolower(trim((string) $e)) === strtolower((string) $user['email'])) {
            return true;
        }
    }
    return false;
}

function uuid_v4(): string
{
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}
