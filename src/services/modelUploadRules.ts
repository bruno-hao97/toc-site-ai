import type { GommoModel, JobType } from './api';
import type { ModelSchema } from './modelSchema';

export interface ReferenceLimits {
  image: number;
  video: number;
}

export interface UploadRules {
  maxImageBytes: number;
  maxVideoBytes: number;
  maxVideoDurationSec: number;
  minImagePx: number;
  acceptImage: string[];
  acceptVideo: string[];
  hint: string;
}

export type UploadTarget =
  | 'referenceImage'
  | 'referenceVideo'
  | 'frameImage'
  | 'frameEnd'
  | 'motionCharacter'
  | 'motionVideo'
  | 'editVideo';

const DEFAULT_IMAGE_BYTES = 10 * 1024 * 1024;
const DEFAULT_VIDEO_BYTES = 50 * 1024 * 1024;
const DEFAULT_VIDEO_DURATION_SEC = 30;
const DEFAULT_MIN_IMAGE_PX = 300;

function positiveNum(...values: unknown[]): number | undefined {
  for (const v of values) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

function cfgBlock(model: GommoModel | null, ...keys: string[]): Record<string, unknown> {
  const root = (model?.configs || {}) as Record<string, unknown>;
  for (const key of keys) {
    const block = root[key];
    if (block && typeof block === 'object') return block as Record<string, unknown>;
  }
  return {};
}

/** Giới hạn tham chiếu ảnh / video (0/4 0/4) từ configs model. */
export function getReferenceLimits(
  model: GommoModel | null,
  schema: ModelSchema | null,
  jobType: JobType,
): ReferenceLimits {
  const ref = cfgBlock(model, 'reference');
  const limits = ref.limits as { image?: number; video?: number } | undefined;
  const tpl = cfgBlock(model, 'templates');
  const tplOverride = tpl.override as { reference?: { limits?: { image?: number; video?: number } } } | undefined;
  const tplLimits = tplOverride?.reference?.limits;

  let image =
    positiveNum(limits?.image, tplLimits?.image, schema?.limits.maxReferenceImage) ?? 0;
  let video =
    positiveNum(limits?.video, tplLimits?.video, schema?.limits.maxReferenceVideo) ?? 0;

  if (!image && schema?.limits.maxReference) image = schema.limits.maxReference;
  if (!image && model?.withReference) image = 4;

  // Video job thường cho phép ref video; nếu API không khai báo, mirror limit ảnh.
  if (!video && jobType === 'video' && image > 0) video = image;

  return { image, video };
}

function rulesFromBlock(
  block: Record<string, unknown>,
  defaults: Partial<UploadRules>,
): UploadRules {
  return {
    maxImageBytes: positiveNum(block.max_size, block.maxSize, block.max_bytes) ?? defaults.maxImageBytes ?? DEFAULT_IMAGE_BYTES,
    maxVideoBytes: positiveNum(block.max_size, block.maxSize, block.max_bytes) ?? defaults.maxVideoBytes ?? DEFAULT_VIDEO_BYTES,
    maxVideoDurationSec:
      positiveNum(block.max_duration, block.maxDuration, block.duration_max) ??
      defaults.maxVideoDurationSec ??
      DEFAULT_VIDEO_DURATION_SEC,
    minImagePx:
      positiveNum(block.min_size, block.minSize, block.min_width, block.min_height) ??
      defaults.minImagePx ??
      DEFAULT_MIN_IMAGE_PX,
    acceptImage: defaults.acceptImage ?? ['image/jpeg', 'image/png', 'image/webp'],
    acceptVideo: defaults.acceptVideo ?? ['video/mp4', 'video/webm', 'video/quicktime'],
    hint: typeof block.hint === 'string' ? block.hint : (defaults.hint ?? ''),
  };
}

/** Quy tắc upload theo model + ngữ cảnh (frame, ref, motion…). */
export function getUploadRules(
  model: GommoModel | null,
  target: UploadTarget,
): UploadRules {
  const start = cfgBlock(model, 'start_image', 'startImage', 'start_frame', 'startFrame');
  const end = cfgBlock(model, 'end_image', 'endImage', 'end_frame', 'endFrame');
  const character = cfgBlock(model, 'character_image', 'characterImage');
  const motion = cfgBlock(model, 'motion_video', 'motionVideo');
  const ref = cfgBlock(model, 'reference');

  switch (target) {
    case 'motionCharacter':
      return rulesFromBlock(character, {
        maxImageBytes: DEFAULT_IMAGE_BYTES,
        minImagePx: 1024,
        hint: 'JPG / PNG / WebP, ≥ 1K',
      });
    case 'motionVideo':
      return rulesFromBlock(motion, {
        maxVideoBytes: DEFAULT_VIDEO_BYTES,
        maxVideoDurationSec: DEFAULT_VIDEO_DURATION_SEC,
        hint: 'MP4 / WebM, ≤ 30s / 50MB',
      });
    case 'editVideo':
      return rulesFromBlock(cfgBlock(model, 'edit_video', 'editVideo', 'source_video'), {
        maxVideoBytes: DEFAULT_VIDEO_BYTES,
        maxVideoDurationSec: DEFAULT_VIDEO_DURATION_SEC,
        hint: 'MP4 / WebM',
      });
    case 'frameImage':
      return rulesFromBlock(start, {
        maxImageBytes: DEFAULT_IMAGE_BYTES,
        minImagePx: DEFAULT_MIN_IMAGE_PX,
        hint: 'JPG / PNG, ≥ 300px',
      });
    case 'frameEnd':
      return rulesFromBlock(end, {
        maxImageBytes: DEFAULT_IMAGE_BYTES,
        minImagePx: DEFAULT_MIN_IMAGE_PX,
        hint: 'JPG / PNG, ≥ 300px',
      });
    case 'referenceVideo':
      return rulesFromBlock(ref, {
        maxVideoBytes: DEFAULT_VIDEO_BYTES,
        maxVideoDurationSec: DEFAULT_VIDEO_DURATION_SEC,
        hint: 'MP4 / WebM',
      });
    case 'referenceImage':
    default:
      return rulesFromBlock(ref, {
        maxImageBytes: DEFAULT_IMAGE_BYTES,
        minImagePx: DEFAULT_MIN_IMAGE_PX,
        hint: 'JPG / PNG',
      });
  }
}

export function probeVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(video.duration) ? video.duration : 0);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Không đọc được metadata video.'));
    };
    video.src = url;
  });
}

export function probeImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Không đọc được ảnh.'));
    };
    img.src = url;
  });
}

function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${Math.round(n / (1024 * 1024))}MB`;
  if (n >= 1024) return `${Math.round(n / 1024)}KB`;
  return `${n}B`;
}

function mimeAllowed(file: File, allowed: string[]): boolean {
  if (!allowed.length) return true;
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return allowed.some((a) => {
    const m = a.toLowerCase();
    if (m.endsWith('/*')) return type.startsWith(m.slice(0, -1));
    return type === m || name.endsWith(m.replace('image/', '.').replace('video/', '.'));
  });
}

/** Trả về thông báo lỗi hoặc null nếu hợp lệ. */
export async function validateMediaFile(
  file: File,
  rules: UploadRules,
  kind: 'image' | 'video',
): Promise<string | null> {
  const accepts = kind === 'video' ? rules.acceptVideo : rules.acceptImage;
  if (!mimeAllowed(file, accepts)) {
    return kind === 'video'
      ? 'Định dạng video không được hỗ trợ (dùng MP4 / WebM).'
      : 'Định dạng ảnh không được hỗ trợ (dùng JPG / PNG / WebP).';
  }

  const maxBytes = kind === 'video' ? rules.maxVideoBytes : rules.maxImageBytes;
  if (file.size > maxBytes) {
    return `File quá lớn (tối đa ${formatBytes(maxBytes)}).`;
  }

  if (kind === 'video' && rules.maxVideoDurationSec > 0) {
    try {
      const dur = await probeVideoDuration(file);
      if (dur > rules.maxVideoDurationSec + 0.25) {
        return `Video quá dài (tối đa ${rules.maxVideoDurationSec}s, file ~${Math.ceil(dur)}s).`;
      }
    } catch {
      return 'Không đọc được video — thử file MP4 khác.';
    }
  }

  if (kind === 'image' && rules.minImagePx > 0) {
    try {
      const { width, height } = await probeImageDimensions(file);
      if (Math.min(width, height) < rules.minImagePx) {
        return `Ảnh quá nhỏ (cạnh ngắn tối thiểu ${rules.minImagePx}px, file ${width}×${height}).`;
      }
    } catch {
      return 'Không đọc được ảnh.';
    }
  }

  return null;
}

export function mapUploadTarget(
  target: 'component' | 'frameStart' | 'frameEnd' | 'motionChar' | 'motionVideo' | 'editVideo',
  fileKind: 'image' | 'video',
): UploadTarget {
  if (target === 'motionChar') return 'motionCharacter';
  if (target === 'motionVideo') return 'motionVideo';
  if (target === 'editVideo') return 'editVideo';
  if (target === 'frameStart') return 'frameImage';
  if (target === 'frameEnd') return 'frameEnd';
  return fileKind === 'video' ? 'referenceVideo' : 'referenceImage';
}
