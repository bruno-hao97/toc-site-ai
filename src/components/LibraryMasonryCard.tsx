import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Play } from 'lucide-react';
import { useLocale } from '../i18n';
import ComposerSelectCircle from './ComposerSelectCircle';
import {
  feedIsFailed,
  feedPosterUrl,
  feedThumb,
  feedVideoPreviewUrl,
  isVideoMediaUrl,
  type FeedItem,
} from '../services/feedApi';
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

export default function LibraryMasonryCard({
  item,
  kind,
  selected = false,
  onToggleSelect,
  onOpen,
  hoverPreview = false,
}: {
  item: FeedItem;
  kind: 'image' | 'video';
  selected?: boolean;
  onToggleSelect?: () => void;
  onOpen?: () => void;
  hoverPreview?: boolean;
}) {
  const { t } = useLocale();
  const [previewing, setPreviewing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const itemIdRef = useRef(item.id_base);
  const reducedMotion = usePrefersReducedMotion();

  itemIdRef.current = item.id_base;

  const thumb = feedThumb(item);
  const poster = feedPosterUrl(item);
  const posterIsImage = Boolean(poster && !isVideoMediaUrl(poster));
  const previewUrl = feedVideoPreviewUrl(item);
  const isVideo = kind === 'video' || Boolean(previewUrl);
  const processing = isFeedItemProcessing(item);
  const failed = feedIsFailed(item);
  const hasVisual = Boolean(thumb || posterIsImage);
  const prompt = feedItemPrompt(item);
  const canHoverPreview =
    hoverPreview && isVideo && Boolean(previewUrl) && !reducedMotion && !processing;
  const openable = Boolean(onOpen && (previewUrl || thumb || poster) && !processing);

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

  useLayoutEffect(() => {
    if (previewing) playPreview();
  }, [previewing, playPreview]);

  useEffect(() => {
    return () => {
      releaseFeedHoverPreview(itemIdRef.current);
      stopPreview();
    };
  }, [stopPreview]);

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
      <article className={`feed-masonry-card feed-masonry-card--pending processing${selected ? ' selected' : ''}`}>
        <div className="feed-masonry-media feed-masonry-media--pending">
          <MasonryPendingMedia prompt={prompt} status="processing" />
          {onToggleSelect && (
            <ComposerSelectCircle selected={selected} onToggle={onToggleSelect} />
          )}
        </div>
      </article>
    );
  }

  if (!hasVisual && failed) {
    return (
      <article className={`feed-masonry-card feed-masonry-card--pending failed${selected ? ' selected' : ''}`}>
        <div className="feed-masonry-media feed-masonry-media--pending">
          <MasonryPendingMedia prompt={prompt} status="failed" />
          {onToggleSelect && (
            <ComposerSelectCircle selected={selected} onToggle={onToggleSelect} />
          )}
        </div>
      </article>
    );
  }

  const typeLabel = isVideo ? t('feed.typeVideo') : t('feed.typeImage');

  return (
    <article className={`feed-masonry-card${selected ? ' selected' : ''}`}>
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
        ) : thumb ? (
          <img className="feed-masonry-poster" src={thumb} alt="" loading="lazy" />
        ) : isVideo ? (
          <span className="feed-masonry-empty feed-masonry-empty--video" aria-hidden />
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

        {isVideo && !processing && (
          <span className="feed-masonry-play">
            <Play size={16} fill="currentColor" />
          </span>
        )}

        <span className="feed-masonry-type">{typeLabel}</span>

        {item.duration && Number(item.duration) > 0 && !onToggleSelect && (
          <span className="feed-masonry-duration">{item.duration}s</span>
        )}

        {onToggleSelect && (
          <ComposerSelectCircle selected={selected} onToggle={onToggleSelect} />
        )}
      </div>
    </article>
  );
}
