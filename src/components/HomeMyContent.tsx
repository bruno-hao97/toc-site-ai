import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Copy,
  Download,
  ExternalLink,
  Layers,
  MoreVertical,
  Play,
  Share2,
} from 'lucide-react';
import ComposerLibraryPreviewModal, {
  type ComposerPreviewHandlers,
} from './ComposerLibraryPreviewModal';
import { isLoggedIn } from '../services/authStore';
import {
  deleteFeedPost,
  feedDisplayQty,
  feedIsDisplayable,
  feedIsFailed,
  feedMediaUrl,
  feedPosterUrl,
  feedThumb,
  fetchMyImages,
  fetchMyVideos,
  type FeedItem,
  type MinePage,
} from '../services/feedApi';
import {
  feedCreatedShortLabel,
  feedModelDisplay,
  feedRefThumb,
  feedResolutionLabel,
} from '../services/feedLibraryMeta';
import { UpstreamMeError } from '../services/upstreamMe';
import { downloadMediaUrl } from '../utils/downloadMedia';
import ProjectPicker from './ProjectPicker';

export type MineFilter = 'all' | 'video' | 'image';

function mineTime(item: FeedItem): number {
  const v = item.created_time;
  const n = typeof v === 'string' ? Number(v) : v ?? 0;
  return Number.isFinite(n) ? Number(n) : 0;
}

function previewKind(item: FeedItem): 'image' | 'video' {
  return item.type === 'image' ? 'image' : 'video';
}

function canOpenPreview(item: FeedItem): boolean {
  return Boolean(feedMediaUrl(item) || feedThumb(item));
}

function MineCard({ item, onOpen }: { item: FeedItem; onOpen: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const thumb = feedThumb(item);
  const poster = feedPosterUrl(item);
  const media = feedMediaUrl(item);
  const isVideo = item.type !== 'image';
  const model = feedModelDisplay(item);
  const prompt = (item.prompt || item.title || '').trim();
  const qty = feedDisplayQty(item);
  const failed = feedIsFailed(item);
  const refThumb = feedRefThumb(item);
  const resolution = feedResolutionLabel(item);
  const shortDate = feedCreatedShortLabel(item);
  const duration =
    item.duration && Number(item.duration) > 0 ? `${item.duration}s` : '';

  const snapshot = {
    itemId: item.id_base,
    type: item.type,
    prompt: item.prompt || item.title,
    thumbnailUrl: poster || thumb || undefined,
    downloadUrl: media || undefined,
    createdTime: item.created_time,
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const copyPrompt = async () => {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      // ignore
    }
    setMenuOpen(false);
  };

  const shareMedia = async () => {
    const url = media || thumb;
    if (!url) return;
    if (navigator.share) {
      try {
        await navigator.share({ url, title: model || 'VMedia' });
        return;
      } catch {
        // fall through
      }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // ignore
    }
  };

  const dateDuration =
    shortDate && duration ? `${shortDate} - ${duration}` : shortDate || duration;
  const metaRest = [resolution, dateDuration].filter(Boolean).join(' ');

  return (
    <article className="feed-card feed-card-mine">
      <div
        className={`mine-tile${failed ? ' mine-tile-failed' : ''}${canOpenPreview(item) ? ' mine-tile-openable' : ''}`}
        role={canOpenPreview(item) ? 'button' : undefined}
        tabIndex={canOpenPreview(item) ? 0 : undefined}
        onClick={() => {
          if (canOpenPreview(item)) onOpen();
        }}
        onKeyDown={(e) => {
          if (canOpenPreview(item) && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onOpen();
          }
        }}
      >
        {failed && !thumb ? (
          <span className="mine-tile-failed-state">
            <AlertCircle size={28} />
            <strong>GENERATION FAILED</strong>
          </span>
        ) : thumb ? (
          poster || !isVideo ? (
            <img className="mine-tile-media" src={poster || thumb} alt="" loading="lazy" />
          ) : (
            <video
              className="mine-tile-media"
              src={`${thumb}#t=0.001`}
              muted
              playsInline
              preload="metadata"
            />
          )
        ) : (
          <span className="mine-tile-empty">Đang xử lý…</span>
        )}

        {isVideo && !failed && thumb && (
          <span className="mine-tile-play">
            <Play size={22} fill="currentColor" />
          </span>
        )}

        <div className="mine-tile-hover">
          <div className="mine-tile-top">
            <div className="mine-tile-menu-wrap" ref={menuRef}>
              <button
                type="button"
                className="mine-tile-icon-btn"
                aria-label="Tùy chọn"
                aria-expanded={menuOpen}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((v) => !v);
                }}
              >
                <MoreVertical size={16} />
              </button>
              {menuOpen && (
                <div className="mine-tile-menu">
                  {prompt && (
                    <button type="button" onClick={() => void copyPrompt()}>
                      <Copy size={14} /> Sao chép prompt
                    </button>
                  )}
                  {(media || thumb) && (
                    <button
                      type="button"
                      onClick={() => {
                        window.open(media || thumb || '', '_blank', 'noreferrer');
                        setMenuOpen(false);
                      }}
                    >
                      <ExternalLink size={14} /> Mở tab mới
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="mine-tile-top-right">
              <ProjectPicker snapshot={snapshot} className="mine-tile-project-picker" />
              <span className="mine-tile-qty" title="Số lượng">
                <Layers size={12} />
                {qty}
              </span>
              {refThumb && (
                <img className="mine-tile-ref" src={refThumb} alt="" loading="lazy" />
              )}
            </div>
          </div>

          <div className="mine-tile-body">
            {prompt && (
              <div className="mine-tile-prompt-row">
                <p className="mine-tile-prompt">{prompt}</p>
                <button
                  type="button"
                  className="mine-tile-icon-btn mine-tile-copy"
                  aria-label="Sao chép prompt"
                  onClick={(e) => {
                    e.stopPropagation();
                    void copyPrompt();
                  }}
                >
                  <Copy size={14} />
                </button>
              </div>
            )}
          </div>

          <div className="mine-tile-foot">
            {(model || metaRest) && (
              <div className="mine-tile-meta-pill">
                {model && <span className="mine-tile-model-name">{model}</span>}
                {metaRest && <span className="mine-tile-meta-rest">{metaRest}</span>}
              </div>
            )}
            <div className="mine-tile-actions">
              <button
                type="button"
                className="mine-tile-icon-btn"
                aria-label="Chia sẻ"
                onClick={(e) => {
                  e.stopPropagation();
                  void shareMedia();
                }}
              >
                <Share2 size={15} />
              </button>
              {(media || thumb) && (
                <button
                  type="button"
                  className="mine-tile-icon-btn"
                  aria-label="Tải xuống"
                  onClick={(e) => {
                    e.stopPropagation();
                    void downloadMediaUrl(media || thumb || '');
                  }}
                >
                  <Download size={15} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function HomeMyContent({ filter }: { filter: MineFilter }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState('');

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
          if (!feedIsDisplayable(it)) continue;
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

  const previewItem = previewIndex != null ? items[previewIndex] : null;
  const previewKindValue = previewItem ? previewKind(previewItem) : 'video';

  const goStudioReuse = useCallback(
    (item: FeedItem, close: () => void) => {
      const type = item.type === 'image' ? 'image' : 'video';
      navigate(type === 'image' ? '/image' : '/video', {
        state: {
          reuseHistory: {
            type,
            prompt: item.prompt,
            modelSlug: item.model,
            meta: {
              resolution: item.resolution || '',
              ratio: item.ratio || '',
              duration: item.duration || '',
            },
          },
        },
      });
      close();
    },
    [navigate],
  );

  const previewHandlers = useMemo((): ComposerPreviewHandlers => {
    if (!previewItem) return {};
    const close = () => setPreviewIndex(null);
    return {
      onRegenerate: () => goStudioReuse(previewItem, close),
      onReuse: () => goStudioReuse(previewItem, close),
      onEdit:
        previewKind(previewItem) === 'video'
          ? () => goStudioReuse(previewItem, close)
          : undefined,
      onDelete: () => {
        void (async () => {
          setDeletingId(previewItem.id_base);
          try {
            await deleteFeedPost(previewItem.id_base);
            setItems((prev) => prev.filter((it) => it.id_base !== previewItem.id_base));
            close();
          } catch {
            // ignore — có thể job Gommo không xóa qua platform API
          } finally {
            setDeletingId('');
          }
        })();
      },
    };
  }, [previewItem, goStudioReuse]);

  return (
    <div className="home-feed">
      <div className="home-masonry">
        {items.map((item, i) => (
          <MineCard
            key={item.id_base}
            item={item}
            onOpen={() => setPreviewIndex(i)}
          />
        ))}
      </div>

      {previewIndex != null && items.length > 0 && (
        <ComposerLibraryPreviewModal
          items={items}
          index={Math.min(previewIndex, items.length - 1)}
          kind={previewKindValue}
          layout="home"
          onClose={() => setPreviewIndex(null)}
          onNavigate={setPreviewIndex}
          handlers={previewHandlers}
          deleting={Boolean(previewItem && deletingId === previewItem.id_base)}
        />
      )}

      {error && <p className="error feed-status">{error}</p>}
      {loading && <p className="muted feed-status">Đang tải…</p>}
      {!loading && !items.length && !error && (
        <p className="muted feed-status">Bạn chưa có nội dung nào.</p>
      )}

      <div ref={sentinelRef} className="feed-sentinel" />
    </div>
  );
}
