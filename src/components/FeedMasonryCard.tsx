import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import { Heart, Play } from 'lucide-react';
import { useLocale } from '../i18n';
import {
  feedIsFailed,
  feedPosterUrl,
  feedThumb,
  feedVideoPreviewUrl,
  isVideoMediaUrl,
  type FeedItem,
} from '../services/feedApi';
import { isFavorite, toggleFavorite } from '../services/feedFavoritesStore';
import { feedItemPrompt, isFeedItemProcessing } from '../utils/feedProcessing';
import {
  releaseFeedHoverPreview,
  requestFeedHoverPreview,
} from '../utils/feedHoverPreviewManager';
import { MasonryPendingMedia } from './FeedItemPendingCard';

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

export default function FeedMasonryCard({
  item,
  onOpen,
  onFavoriteChange,
  hoverPreview = false,
}: {
  item: FeedItem;
  onOpen?: () => void;
  onFavoriteChange?: () => void;
  /** Leo-style muted video preview on hover (community feed). */
  hoverPreview?: boolean;
}) {
  const { t } = useLocale();
  const [fav, setFav] = useState(() => isFavorite(item.id_base));
  const [previewing, setPreviewing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const itemIdRef = useRef(item.id_base);
  const reducedMotion = usePrefersReducedMotion();

  itemIdRef.current = item.id_base;

  const thumb = feedThumb(item);
  const poster = feedPosterUrl(item);
  const posterIsImage = Boolean(poster && !isVideoMediaUrl(poster));
  const previewUrl = feedVideoPreviewUrl(item);
  const video = Boolean(previewUrl);
  const processing = isFeedItemProcessing(item);
  const failed = feedIsFailed(item);
  const hasVisual = Boolean(thumb || posterIsImage);
  const prompt = feedItemPrompt(item);
  const canHoverPreview = hoverPreview && video && !reducedMotion && !processing;
  const author = item.author?.name || t('feed.anonymous');
  const likes = item.likes_count ?? item.like_count ?? 0;
  const openable = Boolean(onOpen && (previewUrl || thumb) && !processing);

  const stopPreview = useCallback(() => {
    setPreviewing(false);
    const el = videoRef.current;
    if (el) {
      el.pause();
      el.removeAttribute('src');
      el.load();
    }
  }, []);

  const playPreview = useCallback(() => {
    const el = videoRef.current;
    if (!el || !previewUrl) return;
    if (el.getAttribute('src') !== previewUrl) {
      el.src = previewUrl;
      el.load();
    }
    void el.play().catch(() => stopPreview());
  }, [previewUrl, stopPreview]);

  useEffect(() => {
    const sync = () => setFav(isFavorite(item.id_base));
    document.addEventListener('favorites:updated', sync);
    return () => document.removeEventListener('favorites:updated', sync);
  }, [item.id_base]);

  useLayoutEffect(() => {
    if (previewing) playPreview();
  }, [previewing, playPreview]);

  useEffect(() => {
    return () => {
      releaseFeedHoverPreview(itemIdRef.current);
      stopPreview();
    };
  }, [stopPreview]);

  const onHeart = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = toggleFavorite(item.id_base, item);
    setFav(next);
    onFavoriteChange?.();
  };

  const onPointerEnter = () => {
    if (!canHoverPreview) return;
    requestFeedHoverPreview(item.id_base, stopPreview);
    setPreviewing(true);
  };

  const onPointerLeave = () => {
    if (!canHoverPreview) return;
    releaseFeedHoverPreview(item.id_base);
  };

  if (!hasVisual && processing) {
    return (
      <article className="feed-masonry-card feed-masonry-card--pending processing">
        <MasonryPendingMedia prompt={prompt} status="processing" />
      </article>
    );
  }

  if (!hasVisual && failed) {
    return (
      <article className="feed-masonry-card feed-masonry-card--pending failed">
        <MasonryPendingMedia prompt={prompt} status="failed" />
      </article>
    );
  }

  const typeLabel = video ? t('feed.typeVideo') : t('feed.typeImage');

  return (
    <article className="feed-masonry-card">
      <div
        className={`feed-masonry-media${openable ? ' feed-masonry-media-openable' : ''}${previewing ? ' feed-masonry-media--previewing' : ''}`}
        role={openable ? 'button' : undefined}
        tabIndex={openable ? 0 : undefined}
        onClick={() => {
          if (openable) onOpen?.();
        }}
        onKeyDown={(e) => {
          if (openable && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onOpen?.();
          }
        }}
        onMouseEnter={onPointerEnter}
        onMouseLeave={onPointerLeave}
      >
        {posterIsImage ? (
          <img className="feed-masonry-poster" src={poster!} alt="" loading="lazy" />
        ) : video ? (
          <span className="feed-masonry-empty feed-masonry-empty--video" aria-hidden />
        ) : thumb ? (
          <img className="feed-masonry-poster" src={thumb} alt="" loading="lazy" />
        ) : (
          <span className="feed-masonry-empty">{t('feed.processingShort')}</span>
        )}

        {canHoverPreview && (
          <video
            ref={videoRef}
            className="feed-masonry-preview-video"
            muted
            loop
            playsInline
            preload="none"
            aria-hidden
          />
        )}

        {video && (
          <span className="feed-masonry-play">
            <Play size={16} fill="currentColor" />
          </span>
        )}

        <span className="feed-masonry-type">{typeLabel}</span>

        {item.duration && Number(item.duration) > 0 && (
          <span className="feed-masonry-duration">{item.duration}s</span>
        )}

        <div className="feed-masonry-overlay">
          <div className="feed-masonry-user">
            {item.author?.avatar ? (
              <img className="feed-masonry-avatar" src={item.author.avatar} alt="" loading="lazy" />
            ) : (
              <span className="feed-masonry-avatar feed-masonry-avatar-empty" />
            )}
            <span className="feed-masonry-name">{author}</span>
          </div>
        </div>

        <button
          type="button"
          className={`feed-masonry-fav${fav ? ' fav-on' : ''}`}
          aria-label={fav ? t('feed.unfavorite') : t('feed.favorite')}
          onClick={onHeart}
        >
          <Heart size={14} fill={fav ? 'currentColor' : 'none'} />
          {(fav || likes > 0) && <span>{fav ? Math.max(likes, 1) : likes}</span>}
        </button>
      </div>
    </article>
  );
}
