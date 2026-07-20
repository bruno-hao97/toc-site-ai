import type { GommoEnvelope } from './api';

/** Trích URL sau upload — khớp logic extract_upload_url() trên PHP bridge. */
export function extractUploadUrl(envelope: GommoEnvelope): string | null {
  const data = (envelope.data ?? {}) as Record<string, unknown>;
  const raw = (envelope.raw ?? {}) as Record<string, unknown>;
  const imageInfo = (raw.imageInfo ?? {}) as Record<string, unknown>;
  const videoInfo = (raw.videoInfo ?? {}) as Record<string, unknown>;

  const candidates = [
    data.url,
    data.result_url,
    data.image_url,
    data.video_url,
    imageInfo.url,
    imageInfo.result_url,
    videoInfo.url,
    videoInfo.result_url,
    (envelope as { url?: unknown }).url,
  ];

  for (const url of candidates) {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
      return url;
    }
  }
  return null;
}
