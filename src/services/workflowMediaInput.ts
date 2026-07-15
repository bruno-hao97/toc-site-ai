import type { Edge } from '@xyflow/react';
import { getGommoClient } from './authStore';

export type MediaInputKind = 'image' | 'video';
export type MediaSourceTab = 'upload' | 'library' | 'extra' | 'url';

export interface MediaInputDraft {
  sourceTab: MediaSourceTab;
  mediaUrls: string[];
  fileNames: string[];
  randomOutput: boolean;
  /** Chỉ số 1-based (vmedia): random trong [randomMin, randomMax]. */
  randomMin?: number;
  randomMax?: number;
  useOnce: boolean;
  required: boolean;
}

export function defaultMediaInputDraft(): MediaInputDraft {
  return {
    sourceTab: 'upload',
    mediaUrls: [],
    fileNames: [],
    randomOutput: false,
    randomMin: 1,
    randomMax: 1,
    useOnce: false,
    required: false,
  };
}

export function draftFromNodeData(data: Record<string, unknown>): MediaInputDraft {
  const urls = Array.isArray(data.mediaUrls) ? [...(data.mediaUrls as string[])] : [];
  const names = Array.isArray(data.fileNames) ? [...(data.fileNames as string[])] : [];
  const legacyUrl = String(data.resultUrl || '').trim();
  if (legacyUrl && !urls.includes(legacyUrl)) {
    urls.unshift(legacyUrl);
    names.unshift(String(data.fileName || legacyUrl));
  }
  return {
    sourceTab: (data.sourceTab as MediaSourceTab) || 'upload',
    mediaUrls: urls,
    fileNames: names,
    randomOutput: Boolean(data.randomOutput),
    randomMin: Number(data.randomMin) || 1,
    randomMax: Number(data.randomMax) || urls.length || 1,
    useOnce: Boolean(data.useOnce),
    required: Boolean(data.required),
  };
}

export function clampRandomRange(
  count: number,
  min?: number,
  max?: number,
): { randomMin: number; randomMax: number } {
  if (count <= 0) return { randomMin: 1, randomMax: 1 };
  const randomMin = Math.min(Math.max(1, min ?? 1), count);
  const randomMax = Math.min(Math.max(randomMin, max ?? count), count);
  return { randomMin, randomMax };
}

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

export function pickMediaUrl(
  urls: string[],
  randomOutput: boolean,
  useOnce: boolean,
  usedSet: Set<string>,
  randomMin = 1,
  randomMax?: number,
): string {
  let pool = urls.filter((u) => u.trim());
  if (useOnce) pool = pool.filter((u) => !usedSet.has(u));
  if (!pool.length) return '';

  let picked: string;
  if (randomOutput && pool.length > 1) {
    const { randomMin: min, randomMax: max } = clampRandomRange(pool.length, randomMin, randomMax);
    const slice = pool.slice(min - 1, max);
    picked = slice[Math.floor(Math.random() * slice.length)] ?? pool[0];
  } else {
    picked = pool[0];
  }

  if (useOnce && picked) usedSet.add(picked);
  return picked;
}

export function collectInboundMediaUrls(
  nodeId: string,
  edges: Edge[],
  outputs: Record<string, string>,
  targetHandle: string,
): string[] {
  return edges
    .filter((e) => e.target === nodeId && (e.targetHandle ?? 'media-in') === targetHandle)
    .map((e) => outputs[e.source])
    .filter((u): u is string => Boolean(u && isHttpUrl(u)));
}

export function resolveMediaInputUrls(
  nodeId: string,
  data: Record<string, unknown>,
  edges: Edge[],
  outputs: Record<string, string>,
  usedSet: Set<string>,
): { primary: string; all: string[]; firstFrame?: string } {
  const draft = draftFromNodeData(data);
  const urls = [...draft.mediaUrls.filter(isHttpUrl)];
  urls.push(...collectInboundMediaUrls(nodeId, edges, outputs, 'media-in'));
  urls.push(...collectInboundMediaUrls(nodeId, edges, outputs, 'merge'));

  const unique = [...new Set(urls)];
  const primary = pickMediaUrl(
    unique,
    draft.randomOutput,
    draft.useOnce,
    usedSet,
    draft.randomMin ?? 1,
    draft.randomMax ?? unique.length,
  );

  return {
    primary,
    all: unique,
    firstFrame: primary,
  };
}

/** Trích frame đầu từ video — fallback URL gốc nếu CORS/upload lỗi. */
export async function extractVideoFirstFrame(videoUrl: string): Promise<string> {
  try {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.src = videoUrl;
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error('Không tải được video'));
    });
    video.currentTime = Math.min(0.1, video.duration || 0.1);
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
    });
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 360;
    const ctx = canvas.getContext('2d');
    if (!ctx) return videoUrl;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) return videoUrl;
    const file = new File([blob], 'first-frame.jpg', { type: 'image/jpeg' });
    const { url } = await getGommoClient().uploadImage(file);
    return url;
  } catch {
    return videoUrl;
  }
}

export const MEDIA_INPUT_PORTS = {
  image: {
    in: [
      { id: 'trigger', label: 'Kích hoạt', color: '#22d3ee' },
      { id: 'media-in', label: 'Ảnh vào', color: '#c084fc' },
      { id: 'merge', label: 'Gộp ảnh', color: '#c084fc' },
    ],
    out: [
      { id: 'done', label: 'Xong', color: '#e5e7eb' },
      { id: 'media-out', label: 'Ảnh', color: '#c084fc' },
      { id: 'all', label: 'Tất cả ảnh', color: '#c084fc' },
    ],
  },
  video: {
    in: [
      { id: 'trigger', label: 'Kích hoạt', color: '#22d3ee' },
      { id: 'media-in', label: 'Video vào', color: '#60a5fa' },
      { id: 'merge', label: 'Gộp video', color: '#60a5fa' },
    ],
    out: [
      { id: 'done', label: 'Xong', color: '#e5e7eb' },
      { id: 'media-out', label: 'Video', color: '#60a5fa' },
      { id: 'first-frame', label: 'Frame đầu tiên', color: '#c084fc' },
    ],
  },
} as const;
