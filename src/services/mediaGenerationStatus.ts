/** Phân loại trạng thái upstream Gommo (lớp B) và gateway (lớp A). */

export type StatusPhase = 'success' | 'running' | 'failed' | 'unknown';

const GATEWAY_SUCCESS = new Set(['SUCCESS', 'SUCCEEDED', 'DONE', 'COMPLETED']);
const GATEWAY_RUNNING = new Set(['PROCESSING', 'PENDING', 'QUEUED', 'ACTIVE']);
const GATEWAY_FAILED = new Set(['FAILED', 'ERROR', 'CANCELLED', 'REJECTED']);

const IMAGE_SUCCESS = new Set(['SUCCESS']);
const IMAGE_RUNNING = new Set([
  'PENDING_ACTIVE',
  'PROCESSING',
  'PENDING_PROCESSING',
  'PENDING',
]);

const VIDEO_SUCCESS = new Set([
  'MEDIA_GENERATION_STATUS_SUCCESSFUL',
  'SUCCESS',
]);
const VIDEO_RUNNING = new Set([
  'MEDIA_GENERATION_STATUS_PENDING',
  'MEDIA_GENERATION_STATUS_ACTIVE',
  'MEDIA_GENERATION_STATUS_PROCESSING',
  'PENDING',
  'PROCESSING',
  'ACTIVE',
]);

export function normalizeStatus(status: unknown): string {
  if (status == null || status === '') return '';
  return String(status).toUpperCase().trim();
}

export function isValidResultUrl(url: unknown): url is string {
  return typeof url === 'string' && /^https?:\/\//i.test(url.trim());
}

/** Lớp A — poll qua gateway (startPolling / ApiPlaygroundPage). */
export function classifyGatewayStatus(status: unknown, resultUrl?: string | null): StatusPhase {
  const s = normalizeStatus(status);

  if (isValidResultUrl(resultUrl) && !GATEWAY_RUNNING.has(s)) return 'success';
  if (GATEWAY_SUCCESS.has(s)) return 'success';
  if (GATEWAY_RUNNING.has(s)) return 'running';
  if (GATEWAY_FAILED.has(s)) return 'failed';
  if (isValidResultUrl(resultUrl)) return 'success';
  return 'unknown';
}

/** Lớp B — raw.imageInfo.status từ POST /ai/image. */
export function classifySharedImageStatus(status: unknown): StatusPhase {
  const s = normalizeStatus(status);
  if (IMAGE_SUCCESS.has(s)) return 'success';
  if (IMAGE_RUNNING.has(s)) return 'running';
  return 'failed';
}

/** Lớp B — raw.videoInfo.status từ POST /ai/video. */
export function classifySharedVideoStatus(status: unknown): StatusPhase {
  const s = normalizeStatus(status);
  if (VIDEO_SUCCESS.has(s)) return 'success';
  if (VIDEO_RUNNING.has(s)) return 'running';
  return 'failed';
}

export interface ImageStatusPayload {
  imageInfo?: { status?: string; result_url?: string };
  id_base?: string;
  status?: string;
}

export interface VideoStatusPayload {
  videoInfo?: { status?: string; result_url?: string; url?: string };
  id_base?: string;
  status?: string;
}

/** Kiểm tra JSON có cấu trúc image status — không map sâu từng mã. */
export function checkImageStatus(payload: ImageStatusPayload): {
  ok: boolean;
  status: string;
  resultUrl: string | null;
  phase: StatusPhase;
} {
  const status = payload.imageInfo?.status ?? payload.status ?? '';
  const resultUrl = payload.imageInfo?.result_url ?? null;
  return {
    ok: Boolean(payload.imageInfo || payload.id_base || payload.status),
    status,
    resultUrl,
    phase: classifySharedImageStatus(status),
  };
}

/** Kiểm tra JSON có cấu trúc video status. */
export function checkVideoStatus(payload: VideoStatusPayload): {
  ok: boolean;
  status: string;
  resultUrl: string | null;
  phase: StatusPhase;
} {
  const status = payload.videoInfo?.status ?? payload.status ?? '';
  const resultUrl =
    payload.videoInfo?.result_url ?? payload.videoInfo?.url ?? null;
  const phase = classifySharedVideoStatus(status);
  const failedByRegex =
    phase === 'failed' ||
    /FAILED|ERROR|CANCEL/i.test(status);

  return {
    ok: Boolean(payload.videoInfo || payload.id_base || payload.status),
    status,
    resultUrl,
    phase: failedByRegex && phase !== 'success' && phase !== 'running' ? 'failed' : phase,
  };
}

export interface PollSnapshot {
  status: string;
  resultUrl: string | null;
  idBase?: string;
}

/** Trích xuất snapshot từ envelope gateway. */
export function extractPollSnapshot(envelope: {
  data?: {
    status?: string;
    result_url?: string | null;
    id_base?: string;
    job_id?: string;
  };
  raw?: {
    imageInfo?: { status?: string; result_url?: string };
    videoInfo?: { status?: string; result_url?: string; url?: string };
    audioInfo?: { status?: string; result_url?: string; url?: string; file_url?: string };
  };
}): PollSnapshot {
  const data = envelope.data || {};
  const raw = envelope.raw || {};
  const audioInfo = raw.audioInfo;
  return {
    status: data.status || raw.imageInfo?.status || raw.videoInfo?.status || audioInfo?.status || '',
    resultUrl:
      data.result_url ??
      raw.imageInfo?.result_url ??
      raw.videoInfo?.result_url ??
      raw.videoInfo?.url ??
      audioInfo?.file_url ??
      audioInfo?.result_url ??
      audioInfo?.url ??
      null,
    idBase: data.id_base || data.job_id,
  };
}
