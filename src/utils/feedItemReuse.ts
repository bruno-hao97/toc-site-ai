import type { FeedItem } from '../services/feedApi';
import { feedModelDisplay } from '../services/feedLibraryMeta';
import type { HistoryEntry } from '../services/historyStore';
import type { JobType } from '../services/api';
import { jobTypeToHistoryType } from '../constants/studioTypes';

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
