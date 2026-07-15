import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Heart, MessageCircle, Play, Share2, Wand2 } from 'lucide-react';
import { isLoggedIn } from '../services/authStore';
import {
  feedMediaUrl,
  feedModelLabel,
  feedSourceCount,
  feedThumb,
  fetchPublicVideos,
  formatFeedTime,
  type FeedItem,
} from '../services/feedApi';
import { UpstreamMeError } from '../services/upstreamMe';

type MediaFilter = 'all' | 'video' | 'image';

const FILTERS: { id: MediaFilter; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'video', label: 'Video' },
  { id: 'image', label: 'Hình ảnh' },
];

function ExploreCard({ item }: { item: FeedItem }) {
  const thumb = feedThumb(item);
  const media = feedMediaUrl(item);
  const isVideo = item.type !== 'image';
  const sources = feedSourceCount(item);
  const model = feedModelLabel(item);

  return (
    <article className="feed-card">
      <header className="feed-card-head">
        {item.author?.avatar ? (
          <img className="feed-avatar" src={item.author.avatar} alt="" loading="lazy" />
        ) : (
          <span className="feed-avatar feed-avatar-empty" />
        )}
        <span className="feed-author">{item.author?.name || 'Ẩn danh'}</span>
        {item.resolution && <span className="feed-res">{item.resolution}</span>}
      </header>

      <a className="feed-media" href={media || thumb || '#'} target="_blank" rel="noreferrer">
        {thumb ? (
          <img src={thumb} alt="" loading="lazy" />
        ) : (
          <span className="feed-media-empty">Đang xử lý…</span>
        )}
        {isVideo && (
          <span className="feed-play">
            <Play size={20} fill="currentColor" />
          </span>
        )}
        {model && <span className="feed-model-badge">{model}</span>}
        {sources > 1 && <span className="feed-count">{sources}</span>}
        {item.duration && Number(item.duration) > 0 && (
          <span className="feed-duration">{item.duration}s</span>
        )}
      </a>

      <div className="feed-card-meta">
        <span className="feed-time">{formatFeedTime(item.created_time)}</span>
      </div>

      <footer className="feed-card-foot">
        <div className="feed-stats">
          <span><Heart size={14} /> {item.likes_count ?? item.like_count ?? 0}</span>
          <span><MessageCircle size={14} /> {item.comments_count ?? 0}</span>
          <span><Share2 size={14} /></span>
        </div>
        <button type="button" className="feed-remix">
          <Wand2 size={13} /> {isVideo ? 'Edit video' : 'Remix'}
        </button>
      </footer>
    </article>
  );
}

export default function ExplorePage() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [filter, setFilter] = useState<MediaFilter>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const afterIdRef = useRef('');
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
      const page = await fetchPublicVideos({
        limit: 30,
        afterId: afterIdRef.current,
      });

      const fresh = page.items.filter((it) => {
        if (!it.id_base || seenRef.current.has(it.id_base)) return false;
        if (!feedThumb(it)) return false;
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
      { rootMargin: '600px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  const visible = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'image') return items.filter((it) => it.type === 'image');
    return items.filter((it) => it.type !== 'image');
  }, [items, filter]);

  return (
    <div className="home-explore">
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
        <div className="home-masonry">
          {visible.map((item) => (
            <ExploreCard key={item.id_base} item={item} />
          ))}
        </div>

        {error && <p className="error feed-status">{error}</p>}
        {loading && <p className="muted feed-status">Đang tải…</p>}
        {!loading && !visible.length && !error && (
          <p className="muted feed-status">Chưa có nội dung.</p>
        )}

        <div ref={sentinelRef} className="feed-sentinel" />
      </div>
    </div>
  );
}
