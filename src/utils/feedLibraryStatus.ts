import type { FeedItem } from '../services/feedApi';
import { feedIsFailed } from '../services/feedApi';
import { isFeedItemProcessing } from './feedProcessing';

export type LibraryStatusFilter = 'all' | 'success' | 'failed';

export type FeedItemLibraryStatus = 'processing' | 'failed' | 'success';

const VALID_STATUS_FILTERS = new Set<LibraryStatusFilter>(['all', 'success', 'failed']);

export function statusFilterFromSearchParams(params: URLSearchParams): LibraryStatusFilter {
  const raw = params.get('status');
  if (raw && VALID_STATUS_FILTERS.has(raw as LibraryStatusFilter)) {
    return raw as LibraryStatusFilter;
  }
  return 'all';
}

export function feedItemLibraryStatus(item: FeedItem): FeedItemLibraryStatus {
  if (isFeedItemProcessing(item)) return 'processing';
  if (feedIsFailed(item)) return 'failed';
  return 'success';
}

export function matchesLibraryStatusFilter(
  item: FeedItem,
  filter: LibraryStatusFilter,
): boolean {
  if (filter === 'all') return true;
  return feedItemLibraryStatus(item) === filter;
}

export function librarySearchParams(
  tab: string,
  status: LibraryStatusFilter,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (tab !== 'all') out.tab = tab;
  if (status !== 'all') out.status = status;
  return out;
}
