import type { FeedItem } from '../services/feedApi';
import { feedIsFailed } from '../services/feedApi';
import { isFeedItemProcessing } from './feedProcessing';

export type LibraryStatusFilter = 'all' | 'success' | 'failed';

export type FeedItemLibraryStatus = 'processing' | 'failed' | 'success';

export function librarySearchParams(tab: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (tab !== 'all') out.tab = tab;
  return out;
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
