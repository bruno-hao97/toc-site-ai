import { useCallback, useEffect, useRef, useState } from 'react';
import { Heart, MessageCircle, Play, Share2, Wand2 } from 'lucide-react';
import { isLoggedIn } from '../services/authStore';
import {
  feedMediaUrl,
  feedModelLabel,
  feedSourceCount,
  feedThumb,
  fetchMyImages,
  fetchMyVideos,
  formatFeedTime,
  type FeedItem,
  type MinePage,
} from '../services/feedApi';
import { UpstreamMeError } from '../services/upstreamMe';
import ProjectPicker from './ProjectPicker';

export type MineFilter = 'all' | 'video' | 'image';

function mineTime(item: FeedItem): number {
  const v = item.created_time;
  const n = typeof v === 'string' ? Number(v) : v ?? 0;
  return Number.isFinite(n) ? Number(n) : 0;
}

function MineCard({ item }: { item: FeedItem }) {
  const thumb = feedThumb(item);
  const media = feedMediaUrl(item);
  const isVideo = item.type !== 'image';
  const sources = feedSourceCount(item);
  const model = feedModelLabel(item);

  return (
    <article className="feed-card">
      <div className="feed-card-actions">
        <ProjectPicker
          snapshot={{
            itemId: item.id_base,
            type: item.type,
            prompt: item.prompt || item.title,
            thumbnailUrl: thumb || undefined,
            downloadUrl: media || undefined,
            createdTime: item.created_time,
          }}
        />
      </div>
      <header className="feed-card-head">
        {item.author?.avatar ? (
          <img className="feed-avatar" src={item.author.avatar} alt="" loading="lazy" />
        ) : (
          <span className="feed-avatar feed-avatar-empty" />
        )}
        <span className="feed-author">{item.author?.name || 'Bạn'}</span>
        {item.resolution && item.resolution !== 'unknow' && (
          <span className="feed-res">{item.resolution}</span>
        )}
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

export default function HomeMyContent({ filter }: { filter: MineFilter }) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const videoAfter = useRef('');
  const imageAfter = useRef('');
  const videoDone = useRef(false);
  const imageDone = useRef(false);
  const seen = useRef<Set<string>>(new Set());
  const sentinelRef = useRef<HTMLDivElement | null>(null);

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
      const wantVideo = filter !== 'image' && !videoDone.current;
      const wantImage = filter !== 'video' && !imageDone.current;

      const [vid, img] = await Promise.all([
        wantVideo ? fetchMyVideos({ afterId: videoAfter.current, limit: 30 }) : Promise.resolve(null),
        wantImage ? fetchMyImages({ afterId: imageAfter.current, limit: 30 }) : Promise.resolve(null),
      ]);

      const fresh: FeedItem[] = [];
      const ingest = (
        page: MinePage | null,
        afterRef: React.MutableRefObject<string>,
        doneRef: React.MutableRefObject<boolean>,
      ) => {
        if (!page) return;
        for (const it of page.items) {
          if (!it.id_base || seen.current.has(it.id_base)) continue;
          if (!feedThumb(it) && !feedMediaUrl(it)) continue; // bỏ job lỗi/đang xử lý
          seen.current.add(it.id_base);
          fresh.push(it);
        }
        const noProgress = !page.nextAfterId || page.nextAfterId === afterRef.current;
        afterRef.current = page.nextAfterId;
        if (!page.items.length || noProgress) doneRef.current = true;
      };

      ingest(vid, videoAfter, videoDone);
      ingest(img, imageAfter, imageDone);

      if (fresh.length) {
        setItems((prev) => [...prev, ...fresh].sort((a, b) => mineTime(b) - mineTime(a)));
      }

      const vDone = filter === 'image' || videoDone.current;
      const iDone = filter === 'video' || imageDone.current;
      if (vDone && iDone) setDone(true);
    } catch (err) {
      setError(err instanceof UpstreamMeError ? err.message : String(err));
      setDone(true);
    } finally {
      setLoading(false);
    }
  }, [loading, done, filter]);

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

  return (
    <div className="home-feed">
      <div className="home-masonry">
        {items.map((item) => (
          <MineCard key={item.id_base} item={item} />
        ))}
      </div>

      {error && <p className="error feed-status">{error}</p>}
      {loading && <p className="muted feed-status">Đang tải…</p>}
      {!loading && !items.length && !error && (
        <p className="muted feed-status">Bạn chưa có nội dung nào.</p>
      )}

      <div ref={sentinelRef} className="feed-sentinel" />
    </div>
  );
}
