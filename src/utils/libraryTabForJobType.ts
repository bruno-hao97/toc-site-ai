import type { JobType } from '../services/api';

export type LibraryTabId = 'all' | 'video' | 'image' | 'music' | 'tts' | 'favorite';

export function libraryTabForJobType(type: JobType): LibraryTabId {
  switch (type) {
    case 'image':
    case 'image-upscale':
    case 'remove-bg':
      return 'image';
    case 'video':
    case 'video-upscale':
    case 'video-vfx':
    case 'video-subtitle':
    case 'video-cut':
    case 'avatar-lipsync':
      return 'video';
    case 'music':
      return 'music';
    case 'tts':
      return 'tts';
    default:
      return 'all';
  }
}

export function libraryPathForJobType(type: JobType): string {
  const tab = libraryTabForJobType(type);
  return tab === 'all' ? '/home/library' : `/home/library?tab=${tab}`;
}
