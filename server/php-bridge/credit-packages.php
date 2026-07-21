<?php
declare(strict_types=1);

/**
 * Danh sách gói nạp credit — static JSON (không cần Node/PayOS).
 * Khớp server/services/creditPackages.ts
 *
 * GET /api/platform/credit-packages.php
 * GET /api/platform/credit-packages.php?probe=1
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: GET, OPTIONS');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed'], JSON_UNESCAPED_UNICODE);
    exit;
}

const CREDIT_PACKAGES_BRIDGE_BUILD = '2026-07-21-credit1';

$packages = [
    [
        'id' => 'basic-member',
        'name' => 'BASIC - MEMBER',
        'amountVnd' => 50000,
        'credits' => 50000,
        'bonusPercent' => 0,
    ],
    [
        'id' => 'vip-member',
        'name' => 'VIP MEMBER',
        'amountVnd' => 200000,
        'credits' => 210000,
        'bonusPercent' => 5,
    ],
    [
        'id' => 'ultra-member',
        'name' => 'ULTRA MEMBER',
        'amountVnd' => 1000000,
        'credits' => 1100000,
        'bonusPercent' => 10,
        'featured' => true,
        'prioritySupport' => true,
    ],
    [
        'id' => 'infinity-member',
        'name' => 'INFINITY MEMBER',
        'amountVnd' => 5000000,
        'credits' => 5750000,
        'bonusPercent' => 12,
        'prioritySupport' => true,
    ],
    [
        'id' => 'agency-pro',
        'name' => 'AGENCY PRO',
        'amountVnd' => 10000000,
        'credits' => 11500000,
        'bonusPercent' => 15,
        'prioritySupport' => true,
    ],
    [
        'id' => 'master-agency',
        'name' => 'MASTER AGENCY',
        'amountVnd' => 20000000,
        'credits' => 24000000,
        'bonusPercent' => 20,
        'prioritySupport' => true,
    ],
];

if ((string) ($_GET['probe'] ?? '') === '1') {
    echo json_encode([
        'success' => true,
        'data' => [
            'bridgeBuild' => CREDIT_PACKAGES_BRIDGE_BUILD,
            'count' => count($packages),
        ],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode([
    'success' => true,
    'data' => $packages,
], JSON_UNESCAPED_UNICODE);
