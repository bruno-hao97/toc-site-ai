import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Copy,
  Download,
  ExternalLink,
  Heart,
  Layers,
  Mic,
  MoreVertical,
  Music,
  Play,
  Share2,
} from 'lucide-react';
import ComposerLibraryPreviewModal, {
  type ComposerPreviewHandlers,
} from './ComposerLibraryPreviewModal';
import HomeAudioLibrary from './HomeAudioLibrary';
import HomeMusicLibrary from './HomeMusicLibrary';
import { isLoggedIn } from '../services/authStore';
import { studioRouteForType } from '../constants/studioTypes';
import type { JobType } from '../services/api';
import {
  deleteFeedPost,
  feedDisplayQty,
  feedIsAudioItem,
  feedIsDisplayable,
  feedIsFailed,
  feedMediaUrl,
  feedPosterUrl,
  feedThumb,
  fetchMyAudio,
  fetchMyImages,
  fetchMyMusic,
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
import {
  isFavorite,
  loadFavorites,
  toggleFavorite,
} from '../services/feedFavoritesStore';
import { UpstreamMeError } from '../services/upstreamMe';
import { downloadMediaUrl } from '../utils/downloadMedia';
import ProjectPicker from './ProjectPicker';

export type MineFilter = 'all' | 'video' | 'image' | 'music' | 'tts' | 'favorite';

function mineTime(item: FeedItem): number {
  const v = item.created_time;
  const n = typeof v === 'string' ? Number(v) : v ?? 0;
  return Number.isFinite(n) ? Number(n) : 0;
}

function previewKind(item: FeedItem): 'image' | 'video' {
  return item.type === 'image' ? 'image' : 'video';
}

function canOpenPreview(item: FeedItem): boolean {
  if (feedIsAudioItem(item)) return Boolean(feedMediaUrl(item));
  return Boolean(feedMediaUrl(item) || feedThumb(item));
}

function itemJobType(item: FeedItem): JobType {
  const t = (item.type || '').toLowerCase();
  if (t === 'music') return 'music';
  if (t === 'tts' || t.includes('audio')) return 'tts';
  if (t === 'image') return 'image';
  if (t === 'avatar-lipsync') return 'avatar-lipsync';
  return 'video';
}

function audioBadge(item: FeedItem): string {
  const t = (item.type || '').toLowerCase();
  if (t === 'music') return 'AI MUSIC';
  return 'AI AUDIO';
}

function MineCard({
  item,
  favorited,
  onOpen,
  onToggleFavorite,
}: {
  item: FeedItem;
  favorited: boolean;
  onOpen: () => void;
  onToggleFavorite: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const thumb = feedThumb(item);
  const poster = feedPosterUrl(item);
  const media = feedMediaUrl(item);
  const isAudio = feedIsAudioItem(item);
  const isVideo = !isAudio && item.type !== 'image';
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
        await navigator.share({ url, title: model || 'Pro.agi.vn' });
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
        className={`mine-tile${failed ? ' mine-tile-failed' : ''}${canOpenPreview(item) ? ' mine-tile-openable' : ''}${isAudio ? ' mine-tile-audio' : ''}`}
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
        {failed && !thumb && !media ? (
          <span className="mine-tile-failed-state">
            <AlertCircle size={28} />
            <strong>GENERATION FAILED</strong>
          </span>
        ) : isAudio ? (
          thumb ? (
            <>
              <img className="mine-tile-media" src={thumb} alt="" loading="lazy" />
              <span className="mine-tile-audio-badge mine-tile-audio-badge--overlay">
                {audioBadge(item)}
              </span>
              {duration && <span className="mine-tile-audio-duration">{duration}</span>}
            </>
          ) : (
            <span className="mine-tile-audio-visual">
              {(item.type || '').toLowerCase() === 'music' ? (
                <Music size={36} />
              ) : (
                <Mic size={36} />
              )}
              <span className="mine-tile-audio-badge">{audioBadge(item)}</span>
              {duration && <span className="mine-tile-audio-duration">{duration}</span>}
            </span>
          )
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

        {(isVideo || isAudio) && !failed && (thumb || media) && (
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
              <button
                type="button"
                className={`mine-tile-icon-btn${favorited ? ' mine-tile-fav-on' : ''}`}
                aria-label={favorited ? 'Bỏ yêu thích' : 'Yêu thích'}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite();
                }}
              >
                <Heart size={15} fill={favorited ? 'currentColor' : 'none'} />
              </button>
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

type SourceKey = 'video' | 'image' | 'music' | 'tts';

const ALL_SOURCES: SourceKey[] = ['video', 'image', 'music', 'tts'];

function sourcesForFilter(filter: MineFilter): SourceKey[] {
  if (filter === 'all' || filter === 'favorite') return ALL_SOURCES;
  if (filter === 'video') return ['video'];
  if (filter === 'image') return ['image'];
  if (filter === 'music') return ['music'];
  return ['tts'];
}

async function fetchSource(source: SourceKey, afterId: string, limit: number): Promise<MinePage> {
  const params = { afterId, limit };
  switch (source) {
    case 'video':
      return fetchMyVideos(params);
    case 'image':
      return fetchMyImages(params);
    case 'music':
      return fetchMyMusic(params);
    case 'tts':
      return fetchMyAudio(params);
  }
}

export default function HomeMyContent({ filter }: { filter: MineFilter }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState('');
  const [favTick, setFavTick] = useState(0);
  const [audioPlayerUrl, setAudioPlayerUrl] = useState<string | null>(null);

  const afterRefs = useRef<Record<SourceKey, string>>({
    video: '',
    image: '',
    music: '',
    tts: '',
  });
  const doneRefs = useRef<Record<SourceKey, boolean>>({
    video: false,
    image: false,
    music: false,
    tts: false,
  });
  const seen = useRef<Set<string>>(new Set());
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
      const sources = sourcesForFilter(filter);
      const favIds = filter === 'favorite' ? loadFavorites() : null;
      if (favIds && favIds.size === 0) {
        setDone(true);
        return;
      }

      const active = sources.filter((s) => !doneRefs.current[s]);
      if (!active.length) {
        setDone(true);
        return;
      }

      const pages = await Promise.all(
        active.map(async (source) => {
          const page = await fetchSource(source, afterRefs.current[source], 30);
          return { source, page };
        }),
      );

      const fresh: FeedItem[] = [];
      for (const { source, page } of pages) {
        for (const it of page.items) {
          if (!it.id_base || seen.current.has(it.id_base)) continue;
          if (!feedIsDisplayable(it)) continue;
          if (favIds && !favIds.has(it.id_base)) continue;
          seen.current.add(it.id_base);
          fresh.push(it);
        }
        const noProgress =
          !page.nextAfterId || page.nextAfterId === afterRefs.current[source];
        afterRefs.current[source] = page.nextAfterId;
        if (!page.items.length || noProgress) doneRefs.current[source] = true;
      }

      if (fresh.length) {
        setItems((prev) => [...prev, ...fresh].sort((a, b) => mineTime(b) - mineTime(a)));
      }

      if (sources.every((s) => doneRefs.current[s])) setDone(true);
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
    const onFav = () => setFavTick((n) => n + 1);
    document.addEventListener('favorites:updated', onFav);
    return () => document.removeEventListener('favorites:updated', onFav);
  }, []);

  useEffect(() => {
    if (filter !== 'favorite') return;
    const favIds = loadFavorites();
    setItems((prev) => prev.filter((it) => favIds.has(it.id_base)));
  }, [favTick, filter]);

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

  useEffect(() => {
    if (!audioPlayerUrl || !audioRef.current) return;
    void audioRef.current.play().catch(() => {
      // autoplay blocked — user can use native controls
    });
  }, [audioPlayerUrl]);

  const visualItems = useMemo(
    () => items.filter((it) => !feedIsAudioItem(it)),
    [items],
  );

  const previewItem = previewIndex != null ? visualItems[previewIndex] : null;
  const previewKindValue = previewItem ? previewKind(previewItem) : 'video';

  const openItem = useCallback((item: FeedItem) => {
    if (feedIsAudioItem(item)) {
      const url = feedMediaUrl(item);
      if (url) setAudioPlayerUrl(url);
      return;
    }
    const idx = visualItems.findIndex((it) => it.id_base === item.id_base);
    if (idx >= 0) setPreviewIndex(idx);
  }, [visualItems]);

  const goStudioReuse = useCallback(
    (item: FeedItem, close: () => void) => {
      const type = itemJobType(item);
      navigate(studioRouteForType(type), {
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

  const emptyLabel =
    filter === 'favorite'
      ? 'Chưa có mục yêu thích nào. Bấm ♥ trên sản phẩm để lưu.'
      : filter === 'music'
        ? 'Bạn chưa có bài nhạc nào.'
        : filter === 'tts'
          ? 'Bạn chưa có âm thanh nào.'
          : 'Bạn chưa có nội dung nào.';

  const playAudioItem = useCallback((item: FeedItem) => {
    const url = feedMediaUrl(item);
    if (url) setAudioPlayerUrl(url);
  }, []);

  const deleteLibraryItem = useCallback((item: FeedItem) => {
    void (async () => {
      try {
        await deleteFeedPost(item.id_base);
      } catch {
        // local-only history items may fail platform delete — still remove from UI
      }
      setItems((prev) => prev.filter((it) => it.id_base !== item.id_base));
      setAudioPlayerUrl((url) => (url && feedMediaUrl(item) === url ? null : url));
    })();
  }, []);

  const libraryBody =
    filter === 'tts' ? (
      <HomeAudioLibrary
        items={items}
        playingId={
          audioPlayerUrl
            ? items.find((it) => feedMediaUrl(it) === audioPlayerUrl)?.id_base ?? null
            : null
        }
        onPlay={playAudioItem}
        onDelete={deleteLibraryItem}
      />
    ) : filter === 'music' ? (
      <HomeMusicLibrary
        items={items}
        onPlay={playAudioItem}
        onDelete={deleteLibraryItem}
      />
    ) : (
      <div className="home-masonry">
        {items.map((item) => (
          <MineCard
            key={item.id_base}
            item={item}
            favorited={isFavorite(item.id_base)}
            onOpen={() => openItem(item)}
            onToggleFavorite={() => {
              toggleFavorite(item.id_base, item);
              setFavTick((n) => n + 1);
            }}
          />
        ))}
      </div>
    );

  return (
    <div className="home-feed">
      {libraryBody}

      {previewIndex != null && visualItems.length > 0 && (
        <ComposerLibraryPreviewModal
          items={visualItems}
          index={Math.min(previewIndex, visualItems.length - 1)}
          kind={previewKindValue}
          layout="home"
          onClose={() => setPreviewIndex(null)}
          onNavigate={setPreviewIndex}
          handlers={previewHandlers}
          deleting={Boolean(previewItem && deletingId === previewItem.id_base)}
        />
      )}

      {audioPlayerUrl && (
        <div className="mine-audio-player-bar">
          <audio ref={audioRef} src={audioPlayerUrl} controls autoPlay />
          <button
            type="button"
            className="mine-audio-player-close"
            onClick={() => setAudioPlayerUrl(null)}
          >
            Đóng
          </button>
        </div>
      )}

      {error && <p className="error feed-status">{error}</p>}
      {loading && <p className="muted feed-status">Đang tải…</p>}
      {!loading && !items.length && !error && (
        <p className="muted feed-status">{emptyLabel}</p>
      )}

      <div ref={sentinelRef} className="feed-sentinel" />
    </div>
  );
}
