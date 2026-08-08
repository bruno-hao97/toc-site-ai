import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import HomeFeedEmpty from './home/HomeFeedEmpty';
import { useNavigate } from 'react-router-dom';
import ComposerLibraryPreviewModal, {
  type ComposerPreviewHandlers,
} from './ComposerLibraryPreviewModal';
import FeedMasonryCard from './FeedMasonryCard';
import { isLoggedIn } from '../services/authStore';
import {
  feedMediaUrl,
  feedThumb,
  fetchNewsfeed,
  fetchPublicVideos,
  type FeedItem,
} from '../services/feedApi';
import { isFavorite, loadFavoriteItems } from '../services/feedFavoritesStore';
import { UpstreamMeError } from '../services/upstreamMe';
import {
  canOpenFeedPreview,
  feedPreviewKind,
  navigateFeedItemReuse,
} from '../utils/feedItemReuse';
import type { CommunityMediaFilter } from './home/HomeCommunityFilters';

function hasVisual(item: FeedItem): boolean {
  return Boolean(feedThumb(item) || feedMediaUrl(item));
}

function feedItemMediaKind(item: FeedItem): 'video' | 'image' {
  const t = (item.type || '').toLowerCase();
  if (t === 'image' || t === 'image-upscale' || t === 'remove-bg') return 'image';
  if (t === 'video' || t === 'avatar-lipsync') return 'video';
  const media = feedMediaUrl(item) || '';
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(media) ? 'video' : 'image';
}

function isMusicItem(item: FeedItem): boolean {
  return (item.type || '').toLowerCase() === 'music';
}

function isTtsItem(item: FeedItem): boolean {
  const t = (item.type || '').toLowerCase();
  if (t === 'music') return false;
  if (t === 'tts' || t.includes('voice') || t.includes('speech')) return true;
  return false;
}

function buildFavoriteFeedItems(items: FeedItem[]): FeedItem[] {
  const out: FeedItem[] = [];
  const seen = new Set<string>();

  for (const item of loadFavoriteItems()) {
    if (!item.id_base || seen.has(item.id_base)) continue;
    if (!hasVisual(item)) continue;
    seen.add(item.id_base);
    out.push(item);
  }

  for (const item of items) {
    if (!item.id_base || seen.has(item.id_base)) continue;
    if (!isFavorite(item.id_base) || !hasVisual(item)) continue;
    seen.add(item.id_base);
    out.push(item);
  }

  return out;
}

function matchesMediaFilter(item: FeedItem, filter: CommunityMediaFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'favorite') return isFavorite(item.id_base);
  if (filter === 'music') return isMusicItem(item);
  if (filter === 'tts') return isTtsItem(item);
  if (filter === 'video' || filter === 'image') {
    return feedItemMediaKind(item) === filter;
  }
  return true;
}

export type HomeFeedVariant = 'feed' | 'recommended';

export default function HomeFeed({
  variant = 'feed',
  mediaFilter = 'all',
}: {
  variant?: HomeFeedVariant;
  mediaFilter?: CommunityMediaFilter;
}) {
  const navigate = useNavigate();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [favTick, setFavTick] = useState(0);

  const afterVideoRef = useRef('');
  const afterImageRef = useRef('');
  const publicAfterRef = useRef('');
  const publicDoneRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const seenRef = useRef<Set<string>>(new Set());

  const loadMore = useCallback(async () => {
    if (loading || done) return;
    if (!isLoggedIn()) {
      setError('Chưa đăng nhập.');
      setDone(true);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const fresh: FeedItem[] = [];
      const ingest = (list: FeedItem[]) => {
        for (const it of list) {
          if (!it.id_base || seenRef.current.has(it.id_base)) continue;
          if (!hasVisual(it)) continue;
          seenRef.current.add(it.id_base);
          fresh.push(it);
        }
      };

      if (variant === 'recommended') {
        const pub = await fetchPublicVideos({
          type: 'public_home',
          limit: 30,
          afterId: publicAfterRef.current,
        });
        ingest(pub.items);
        const noPubProgress = !pub.nextAfterId || pub.nextAfterId === publicAfterRef.current;
        publicAfterRef.current = pub.nextAfterId;
        if (fresh.length) setItems((prev) => [...prev, ...fresh]);
        if (!pub.items.length || noPubProgress) setDone(true);
        return;
      }

      // Newsfeed (ảnh + video) + bổ sung public library nếu newsfeed thiếu ảnh.
      const [page, pub] = await Promise.all([
        fetchNewsfeed({
          limit: 30,
          afterVideoId: afterVideoRef.current,
          afterImageId: afterImageRef.current,
        }),
        publicDoneRef.current
          ? Promise.resolve(null)
          : fetchPublicVideos({
              type: 'public_home',
              limit: 20,
              afterId: publicAfterRef.current,
            }).catch(() => null),
      ]);

      ingest(page.items);
      if (pub) {
        ingest(pub.items);
        const noPubProgress =
          !pub.nextAfterId || pub.nextAfterId === publicAfterRef.current;
        publicAfterRef.current = pub.nextAfterId;
        if (!pub.items.length || noPubProgress) publicDoneRef.current = true;
      }

      if (fresh.length) {
        setItems((prev) => [...prev, ...fresh]);
      }

      const noNewsProgress =
        page.nextAfterVideoId === afterVideoRef.current &&
        page.nextAfterImageId === afterImageRef.current;

      afterVideoRef.current = page.nextAfterVideoId;
      afterImageRef.current = page.nextAfterImageId;

      const newsDone = !page.items.length || noNewsProgress;
      if (newsDone && publicDoneRef.current) setDone(true);
    } catch (err) {
      setError(err instanceof UpstreamMeError ? err.message : String(err));
      setDone(true);
    } finally {
      setLoading(false);
    }
  }, [loading, done, variant]);

  useEffect(() => {
    void loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onFav = () => setFavTick((n) => n + 1);
    document.addEventListener('favorites:updated', onFav);
    return () => document.removeEventListener('favorites:updated', onFav);
  }, []);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: '400px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  const filteredItems = useMemo(() => {
    if (mediaFilter === 'favorite') {
      return buildFavoriteFeedItems(items);
    }
    return items.filter((item) => matchesMediaFilter(item, mediaFilter));
  }, [items, mediaFilter, favTick]);

  const visualItems = useMemo(
    () => filteredItems.filter(canOpenFeedPreview),
    [filteredItems],
  );
  const previewItem = previewIndex != null ? visualItems[previewIndex] : null;
  const previewKindValue = previewItem ? feedPreviewKind(previewItem) : 'video';

  const openItem = useCallback(
    (item: FeedItem) => {
      const idx = visualItems.findIndex((it) => it.id_base === item.id_base);
      if (idx >= 0) setPreviewIndex(idx);
    },
    [visualItems],
  );

  const previewHandlers = useMemo((): ComposerPreviewHandlers => {
    if (!previewItem) return {};
    const close = () => setPreviewIndex(null);
    const reuse = () => navigateFeedItemReuse(navigate, previewItem, close);
    return {
      onRegenerate: reuse,
      onReuse: reuse,
      onEdit: feedPreviewKind(previewItem) === 'video' ? reuse : undefined,
    };
  }, [previewItem, navigate]);

  return (
    <div className="home-feed">
      <div className="home-masonry home-masonry--feed">
        {filteredItems.map((item) => (
          <FeedMasonryCard
            key={item.id_base}
            item={item}
            onOpen={() => openItem(item)}
          />
        ))}
      </div>

      {previewIndex != null && visualItems.length > 0 && (
        <ComposerLibraryPreviewModal
          items={visualItems}
          index={Math.min(previewIndex, visualItems.length - 1)}
          kind={previewKindValue}
          layout="home"
          onClose={() => setPreviewIndex(null)}
          onNavigate={setPreviewIndex}
          handlers={previewHandlers}
        />
      )}

      {error && <p className="error feed-status">{error}</p>}
      {loading && <p className="muted feed-status">Đang tải…</p>}
      {!loading && !filteredItems.length && !error && items.length > 0 && (
        <HomeFeedEmpty
          title="Không có tác phẩm loại này"
          description={
            mediaFilter === 'favorite'
              ? 'Nhấn tim trên ảnh hoặc video để lưu yêu thích.'
              : mediaFilter === 'music' || mediaFilter === 'tts'
                ? 'Cuộn thêm hoặc thử bộ lọc Tất cả.'
                : 'Thử bộ lọc Tất cả hoặc loại khác.'
          }
        />
      )}
      {!loading && !items.length && !error && (
        <HomeFeedEmpty
          title={
            variant === 'recommended'
              ? 'Chưa có gợi ý cho bạn'
              : 'Bảng tin đang trống'
          }
          description={
            variant === 'recommended'
              ? 'Thử lại sau hoặc khám phá bảng tin chính.'
              : 'Tạo video hoặc ảnh đầu tiên — hiển thị ngay tại đây.'
          }
        />
      )}

      <div ref={sentinelRef} className="feed-sentinel" />
    </div>
  );
}
