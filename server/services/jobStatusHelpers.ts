export function isJobSuccessClaim(status: string): boolean {
  const s = status.trim().toUpperCase();
  if (!s) return false;
  return (
    s === 'SUCCESS' ||
    s === 'SUCCEEDED' ||
    s === 'DONE' ||
    s === 'COMPLETED' ||
    s === 'FINISH' ||
    s === 'FINISHED' ||
    s.startsWith('SUCCESS')
  );
}

export function isJobFailedStatus(status: string): boolean {
  const s = status.trim().toUpperCase();
  if (!s) return false;
  const failed = new Set([
    'FAILED',
    'FAILURE',
    'ERROR',
    'CANCELLED',
    'CANCELED',
    'REJECTED',
    'FAIL',
    'NSFW',
    'BLOCKED',
    'DENIED',
    'TIMEOUT',
    'TIMED_OUT',
    'MEDIA_GENERATION_STATUS_FAILED',
    'MEDIA_GENERATION_STATUS_ERROR',
    'MEDIA_GENERATION_STATUS_CANCELLED',
  ]);
  if (failed.has(s)) return true;
  if (
    s.startsWith('PENDING') ||
    s.startsWith('SUCCESS') ||
    s.startsWith('PROCESS') ||
    s.includes('ACTIVE') ||
    s.includes('QUEUE') ||
    s === 'RUNNING' ||
    s === 'FINISH' ||
    s === 'FINISHED' ||
    s === 'DONE' ||
    s === 'COMPLETED'
  ) {
    return false;
  }
  return (
    s.includes('FAIL') ||
    s.includes('ERROR') ||
    s.includes('REJECT') ||
    s.includes('CANCEL') ||
    s.includes('DENIED') ||
    s.includes('BLOCK') ||
    s.includes('TIMEOUT')
  );
}

export function normalizeStoredJobStatus(status: string, resultUrl: string | null): string {
  if (resultUrl) return 'success';
  if (isJobFailedStatus(status)) {
    const s = status.trim().toUpperCase();
    return s || 'FAILED';
  }
  if (isJobSuccessClaim(status) || status === '') return 'processing';
  return status;
}
