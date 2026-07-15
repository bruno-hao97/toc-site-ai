import type { FeedItem } from '../services/feedApi';
import { isMediaUrl, type HistoryEntry } from '../services/historyStore';
import type { JobType } from '../services/api';

export function historyJobUsesClibLayout(jobType: JobType): boolean {
  return jobType === 'image' || jobType === 'video' || jobType === 'avatar-lipsync';
}

export function historyComposerMediaKind(jobType: JobType): 'image' | 'video' {
  return jobType === 'image' ? 'image' : 'video';
}

export function isClibHistoryEntry(entry: HistoryEntry, jobType: JobType): boolean {
  if (!historyJobUsesClibLayout(jobType)) return false;
  const kind = isMediaUrl(entry.resultUrl, entry.type);
  return kind === 'image' || kind === 'video';
}

function historyFeedType(entry: HistoryEntry): 'image' | 'video' {
  const kind = isMediaUrl(entry.resultUrl, entry.type);
  return kind === 'video' ? 'video' : 'image';
}

export function historyEntryToFeedItem(entry: HistoryEntry): FeedItem {
  const resolution = entry.meta?.resolution?.trim() || '';
  const ratio = entry.meta?.ratio?.trim() || '';
  const created = Math.floor(new Date(entry.createdAt).getTime() / 1000);

  return {
    id_base: entry.id,
    type: historyFeedType(entry),
    status: 'FINISH',
    prompt: entry.prompt,
    model: entry.modelSlug || entry.modelName,
    resolution: resolution || undefined,
    ratio: ratio || undefined,
    thumbnail_url: entry.resultUrl,
    download_url: entry.resultUrl,
    created_time: Number.isFinite(created) ? created : undefined,
    resolutions: resolution
      ? [{ status: 'FINISH', url: entry.resultUrl, name: resolution }]
      : [{ status: 'FINISH', url: entry.resultUrl }],
  };
}

export function historyEntriesToFeedItems(
  entries: HistoryEntry[],
  jobType: JobType,
): FeedItem[] {
  return entries.filter((e) => isClibHistoryEntry(e, jobType)).map(historyEntryToFeedItem);
}
