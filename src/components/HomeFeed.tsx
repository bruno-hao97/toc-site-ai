import { useCallback, useEffect, useRef, useState } from 'react';
import { isLoggedIn } from '../services/authStore';
import {
  feedMediaUrl,
  feedThumb,
  fetchNewsfeed,
  fetchPublicVideos,
  type FeedItem,
} from '../services/feedApi';
import { UpstreamMeError } from '../services/upstreamMe';
import FeedMasonryCard from './FeedMasonryCard';

function hasVisual(item: FeedItem): boolean {
  return Boolean(feedThumb(item) || feedMediaUrl(item));
}

export default function HomeFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

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

      const fresh: FeedItem[] = [];
      const ingest = (list: FeedItem[]) => {
        for (const it of list) {
          if (!it.id_base || seenRef.current.has(it.id_base)) continue;
          if (!hasVisual(it)) continue;
          seenRef.current.add(it.id_base);
          fresh.push(it);
        }
      };

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
      <div className="home-masonry home-masonry--feed">
        {items.map((item) => (
          <FeedMasonryCard key={item.id_base} item={item} />
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
