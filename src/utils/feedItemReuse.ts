import type { NavigateFunction } from 'react-router-dom';
import type { FeedItem } from '../services/feedApi';
import { feedMediaUrl, feedThumb } from '../services/feedApi';
import { feedModelDisplay } from '../services/feedLibraryMeta';
import type { HistoryEntry } from '../services/historyStore';
import type { JobType } from '../services/api';
import { jobTypeToHistoryType, studioRouteForType } from '../constants/studioTypes';

export function feedPreviewKind(item: FeedItem): 'image' | 'video' {
  const t = (item.type || '').toLowerCase();
  if (t === 'image' || t === 'image-upscale' || t === 'remove-bg') return 'image';
  return 'video';
}

export function feedItemJobType(item: FeedItem): JobType {
  const t = (item.type || '').toLowerCase();
  if (t === 'music') return 'music';
  if (t === 'tts' || t.includes('audio')) return 'tts';
  if (t === 'image' || t === 'image-upscale' || t === 'remove-bg') return 'image';
  if (t === 'avatar-lipsync') return 'avatar-lipsync';
  return 'video';
}

export function canOpenFeedPreview(item: FeedItem): boolean {
  return Boolean(feedMediaUrl(item) || feedThumb(item));
}

export function navigateFeedItemReuse(
  navigate: NavigateFunction,
  item: FeedItem,
  onClose?: () => void,
): void {
  const type = feedItemJobType(item);
  navigate(studioRouteForType(type), {
    state: {
      reuseHistory: {
        type,
        prompt: item.prompt,
        modelSlug: item.model,
        meta: {
          resolution: item.resolution || '',
          ratio: item.ratio || '',
          duration: item.duration || '',
        },
      },
    },
  });
  onClose?.();
}

export function feedItemToHistoryEntry(item: FeedItem, jobType: JobType, resultUrl: string): HistoryEntry {
  return {
    id: item.id_base,
    type: jobTypeToHistoryType(jobType),
    resultUrl,
    prompt: item.prompt,
    modelSlug: item.model,
    modelName: feedModelDisplay(item),
    createdAt: (() => {
      if (item.created_time == null) return new Date().toISOString();
      let ts = typeof item.created_time === 'string' ? Number(item.created_time) : item.created_time;
      if (!Number.isFinite(ts) || ts <= 0) return new Date().toISOString();
      if (ts < 1e12) ts *= 1000;
      return new Date(ts).toISOString();
    })(),
    meta: {
      mode: item.mode || '',
      resolution: item.resolution || '',
      ratio: item.ratio || '',
      duration: item.duration || '',
    },
  };
}
