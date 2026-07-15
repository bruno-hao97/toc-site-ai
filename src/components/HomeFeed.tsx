import { useCallback, useEffect, useRef, useState } from 'react';
import { Heart, MessageCircle, Play, Share2, Sparkles, Wand2 } from 'lucide-react';
import { isLoggedIn } from '../services/authStore';
import {
  feedMediaUrl,
  feedSourceCount,
  feedThumb,
  fetchNewsfeed,
  formatFeedTime,
  type FeedItem,
} from '../services/feedApi';
import { UpstreamMeError } from '../services/upstreamMe';

function FeedCard({ item }: { item: FeedItem }) {
  const thumb = feedThumb(item);
  const media = feedMediaUrl(item);
  const isVideo = item.type === 'video';
  const sources = feedSourceCount(item);

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

      <a
        className="feed-media"
        href={media || thumb || '#'}
        target="_blank"
        rel="noreferrer"
      >
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
        {sources > 1 && <span className="feed-count">{sources}</span>}
        {item.duration && Number(item.duration) > 0 && (
          <span className="feed-duration">{item.duration}s</span>
        )}
      </a>

      <div className="feed-card-meta">
        {item.model && (
          <span className="feed-model">
            <Sparkles size={11} /> {item.model}
          </span>
        )}
        <span className="feed-time">{formatFeedTime(item.created_time)}</span>
      </div>

      <footer className="feed-card-foot">
        <div className="feed-stats">
          <span><Heart size={14} /> {item.likes_count ?? item.like_count ?? 0}</span>
          <span><MessageCircle size={14} /> {item.comments_count ?? 0}</span>
          <span><Share2 size={14} /></span>
        </div>
        <button type="button" className="feed-remix">
          {isVideo ? (
            <>
              <Wand2 size={13} /> Edit video
            </>
          ) : (
            <>
              <Wand2 size={13} /> Remix
            </>
          )}
        </button>
      </footer>
    </article>
  );
}

export default function HomeFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const afterVideoRef = useRef('');
  const afterImageRef = useRef('');
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
      const page = await fetchNewsfeed({
        limit: 30,
        afterVideoId: afterVideoRef.current,
        afterImageId: afterImageRef.current,
      });

      const fresh = page.items.filter((it) => {
        if (!it.id_base || seenRef.current.has(it.id_base)) return false;
        if (!feedThumb(it)) return false;
        seenRef.current.add(it.id_base);
        return true;
      });

      setItems((prev) => [...prev, ...fresh]);

      const noProgress =
        page.nextAfterVideoId === afterVideoRef.current &&
        page.nextAfterImageId === afterImageRef.current;

      afterVideoRef.current = page.nextAfterVideoId;
      afterImageRef.current = page.nextAfterImageId;

      if (!page.items.length || noProgress) setDone(true);
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

  return (
    <div className="home-feed">
      <div className="home-masonry">
        {items.map((item) => (
          <FeedCard key={item.id_base} item={item} />
        ))}
      </div>

      {error && <p className="error feed-status">{error}</p>}
      {loading && <p className="muted feed-status">Đang tải…</p>}
      {!loading && !items.length && !error && (
        <p className="muted feed-status">Chưa có nội dung.</p>
      )}

      <div ref={sentinelRef} className="feed-sentinel" />
    </div>
  );
}
