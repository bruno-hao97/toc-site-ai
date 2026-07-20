<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require __DIR__ . '/gommo.php';
require __DIR__ . '/load-job-status-helpers.php';

header('Content-Type: application/json; charset=utf-8');

json_out(200, [
    'success' => true,
    'data' => [
        'bridgeVersion' => '2026-07-20-job-status-fallback',
        'functions' => [
            'normalize_stored_job_status' => function_exists('normalize_stored_job_status'),
            'is_job_failed_status' => function_exists('is_job_failed_status'),
            'is_job_success_claim' => function_exists('is_job_success_claim'),
        ],
        'files' => [
            'gommo.php' => @filemtime(__DIR__ . '/gommo.php') ?: null,
            'job-create.php' => @filemtime(__DIR__ . '/job-create.php') ?: null,
            'job-status-helpers.php' => @filemtime(__DIR__ . '/job-status-helpers.php') ?: null,
        ],
    ],
]);
