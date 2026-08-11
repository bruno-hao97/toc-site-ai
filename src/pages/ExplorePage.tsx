import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ComposerLibraryPreviewModal, {
  type ComposerPreviewHandlers,
} from '../components/ComposerLibraryPreviewModal';
import FeedMasonryCard from '../components/FeedMasonryCard';
import HomeFeedEmpty from '../components/home/HomeFeedEmpty';
import {
  feedMediaUrl,
  feedThumb,
  fetchPublicVideos,
  type FeedItem,
} from '../services/feedApi';
import { UpstreamMeError } from '../services/upstreamMe';
import {
  canOpenFeedPreview,
  feedPreviewKind,
  navigateFeedItemReuse,
} from '../utils/feedItemReuse';

type MediaFilter = 'all' | 'video' | 'image';

const FILTERS: { id: MediaFilter; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'video', label: 'Video' },
  { id: 'image', label: 'Hình ảnh' },
];

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

function matchesFilter(item: FeedItem, filter: MediaFilter): boolean {
  if (filter === 'all') return true;
  return feedItemMediaKind(item) === filter;
}

export default function ExplorePage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [filter, setFilter] = useState<MediaFilter>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const afterIdRef = useRef('');
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const seenRef = useRef<Set<string>>(new Set());

  const loadMore = useCallback(async () => {
    if (loading || done) return;

    setLoading(true);
    setError('');
    try {
      const page = await fetchPublicVideos({
        limit: 30,
        afterId: afterIdRef.current,
      });

      const fresh = page.items.filter((it) => {
        if (!it.id_base || seenRef.current.has(it.id_base)) return false;
        if (!hasVisual(it)) return false;
        seenRef.current.add(it.id_base);
        return true;
      });

      setItems((prev) => [...prev, ...fresh]);

      const noProgress = !page.nextAfterId || page.nextAfterId === afterIdRef.current;
      afterIdRef.current = page.nextAfterId;

      if (!page.items.length || noProgress || !fresh.length) setDone(true);
    } catch (err) {
      setError(err instanceof UpstreamMeError ? err.message : String(err));
      setDone(true);
    } finally {
      setLoading(false);
    }
  }, [loading, done]);

  useEffect(() => {
    void loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const filteredItems = useMemo(
    () => items.filter((item) => matchesFilter(item, filter)),
    [items, filter],
  );

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
    <div className="home-explore home-explore--community">
      <div className="home-tabs explore-tabs">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`home-tab ${filter === f.id ? 'active' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="home-feed">
        <div className="home-masonry home-masonry--feed">
          {filteredItems.map((item) => (
            <FeedMasonryCard
              key={item.id_base}
              item={item}
              hoverPreview
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
            description="Thử bộ lọc Tất cả hoặc loại khác."
            showCreate={false}
          />
        )}
        {!loading && !items.length && !error && (
          <HomeFeedEmpty
            title="Chưa có nội dung"
            description="Quay lại sau để khám phá tác phẩm từ cộng đồng."
            showCreate={false}
          />
        )}

        <div ref={sentinelRef} className="feed-sentinel" />
      </div>
    </div>
  );
}
