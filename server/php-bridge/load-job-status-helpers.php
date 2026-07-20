<?php
declare(strict_types=1);

/** Load status helpers từ file riêng hoặc fallback inline (1 file upload vẫn chạy). */
if (function_exists('normalize_stored_job_status')) {
    return;
}

$helperFile = __DIR__ . '/job-status-helpers.php';
if (is_file($helperFile)) {
    require $helperFile;
}
if (function_exists('normalize_stored_job_status')) {
    return;
}

if (!function_exists('is_job_success_claim')) {
    function is_job_success_claim(string $status): bool
    {
        $s = strtoupper(trim($status));
        if ($s === '') {
            return false;
        }
        return $s === 'SUCCESS'
            || $s === 'SUCCEEDED'
            || $s === 'DONE'
            || $s === 'COMPLETED'
            || $s === 'FINISH'
            || $s === 'FINISHED'
            || strpos($s, 'SUCCESS') === 0;
    }
}

if (!function_exists('is_job_failed_status')) {
    function is_job_failed_status(string $status): bool
    {
        $s = strtoupper(trim($status));
        if ($s === '') {
            return false;
        }
        static $failed = [
            'FAILED', 'FAILURE', 'ERROR', 'CANCELLED', 'CANCELED', 'REJECTED', 'FAIL',
            'NSFW', 'BLOCKED', 'DENIED', 'TIMEOUT', 'TIMED_OUT',
            'MEDIA_GENERATION_STATUS_FAILED', 'MEDIA_GENERATION_STATUS_ERROR',
            'MEDIA_GENERATION_STATUS_CANCELLED',
        ];
        if (in_array($s, $failed, true)) {
            return true;
        }
        if (
            strpos($s, 'PENDING') === 0
            || strpos($s, 'SUCCESS') === 0
            || strpos($s, 'PROCESS') === 0
            || strpos($s, 'ACTIVE') !== false
            || strpos($s, 'QUEUE') !== false
            || $s === 'RUNNING'
            || $s === 'FINISH'
            || $s === 'FINISHED'
            || $s === 'DONE'
            || $s === 'COMPLETED'
        ) {
            return false;
        }
        if (
            strpos($s, 'FAIL') !== false
            || strpos($s, 'ERROR') !== false
            || strpos($s, 'REJECT') !== false
            || strpos($s, 'CANCEL') !== false
            || strpos($s, 'DENIED') !== false
            || strpos($s, 'BLOCK') !== false
            || strpos($s, 'TIMEOUT') !== false
        ) {
            return true;
        }
        return false;
    }
}

if (!function_exists('normalize_stored_job_status')) {
    function normalize_stored_job_status(string $status, ?string $resultUrl): string
    {
        if ($resultUrl) {
            return 'success';
        }
        if (is_job_failed_status($status)) {
            return strtoupper(trim($status)) !== '' ? strtoupper(trim($status)) : 'FAILED';
        }
        if (is_job_success_claim($status) || $status === '') {
            return 'processing';
        }
        return $status;
    }
}
