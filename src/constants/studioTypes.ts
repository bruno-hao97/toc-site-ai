import type { JobType } from '../services/api';
import type { HistoryType } from '../services/historyStore';
import type { JobSelections } from '../services/modelSchema';

export const STUDIO_JOB_TYPES: { value: JobType; label: string }[] = [
  { value: 'image', label: 'Ảnh' },
  { value: 'video', label: 'Video' },
  { value: 'tts', label: 'Giọng đọc' },
  { value: 'music', label: 'Nhạc' },
  { value: 'avatar-lipsync', label: 'Avatar' },
];

export function jobTypeLabel(type: JobType): string {
  return STUDIO_JOB_TYPES.find((t) => t.value === type)?.label ?? type;
}

export function jobTypeToHistoryType(type: JobType): HistoryType {
  return type;
}

export function defaultSelectionsForType(type: JobType): JobSelections {
  switch (type) {
    case 'video':
      return { prompt: 'a drone shot flying over mountains at sunset' };
    case 'tts':
      return { text: 'Xin chào, đây là thử nghiệm giọng đọc AI.' };
    case 'music':
      return { prompt: 'upbeat electronic dance track', name: 'Demo track' };
    case 'avatar-lipsync':
      return { prompt: 'A person speaking naturally to camera' };
    default:
      return { prompt: 'a cinematic portrait' };
  }
}

export function historyPromptFromSelections(
  type: JobType,
  selections: JobSelections,
): string {
  if (type === 'tts') return selections.text || selections.prompt || '';
  if (type === 'music') return selections.name || selections.prompt || '';
  return selections.prompt || '';
}

export const REUSABLE_JOB_TYPES: JobType[] = [
  'image',
  'video',
  'tts',
  'music',
  'avatar-lipsync',
];

/** Route studio theo loại job (thay cho /app cũ). */
export function studioRouteForType(type: JobType): string {
  switch (type) {
    case 'video':
    case 'avatar-lipsync':
      return '/video';
    case 'music':
      return '/music';
    case 'tts':
      return '/audio';
    default:
      return '/image';
  }
}
