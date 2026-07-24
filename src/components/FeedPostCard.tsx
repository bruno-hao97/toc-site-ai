import { useEffect, useState } from 'react';
import {
  Download,
  Heart,
  MessageCircle,
  MoreVertical,
  Play,
  Share2,
  Wand2,
} from 'lucide-react';
import {
  feedMediaUrl,
  feedThumb,
  formatFeedTime,
  type FeedItem,
} from '../services/feedApi';
import { isFavorite, toggleFavorite } from '../services/feedFavoritesStore';
import { downloadMediaUrl } from '../utils/downloadMedia';

function isVideoItem(item: FeedItem): boolean {
  const t = (item.type || '').toLowerCase();
  return t === 'video' || t === 'avatar-lipsync';
}

export default function FeedPostCard({
  item,
  onOpen,
  onFavoriteChange,
}: {
  item: FeedItem;
  onOpen?: () => void;
  onFavoriteChange?: () => void;
}) {
  const [fav, setFav] = useState(() => isFavorite(item.id_base));
  const thumb = feedThumb(item);
  const media = feedMediaUrl(item);
  const video = isVideoItem(item);
  const author = item.author?.name || 'Ẩn danh';
  const likes = item.likes_count ?? item.like_count ?? 0;
  const comments = item.comments_count ?? 0;
  const prompt = (item.prompt || item.title || '').trim();

  const openable = Boolean(onOpen && (media || thumb));

  useEffect(() => {
    const sync = () => setFav(isFavorite(item.id_base));
    document.addEventListener('favorites:updated', sync);
    return () => document.removeEventListener('favorites:updated', sync);
  }, [item.id_base]);

  const onHeart = () => {
    const next = toggleFavorite(item.id_base, item);
    setFav(next);
    onFavoriteChange?.();
  };

  const share = async () => {
    const url = media || thumb;
    if (!url) return;
    if (navigator.share) {
      try {
        await navigator.share({ url, title: prompt || author });
        return;
      } catch {
        /* fall through */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.open(url, '_blank', 'noreferrer');
    }
  };

  return (
    <article className="feed-post">
      <header className="feed-post-head">
        {item.author?.avatar ? (
          <img className="feed-post-avatar" src={item.author.avatar} alt="" loading="lazy" />
        ) : (
          <span className="feed-post-avatar feed-post-avatar-empty" />
        )}
        <div className="feed-post-head-text">
          <span className="feed-post-author">{author}</span>
          <span className="feed-post-time">{formatFeedTime(item.created_time)}</span>
        </div>
        <button type="button" className="feed-post-more" aria-label="Tùy chọn">
          <MoreVertical size={16} />
        </button>
      </header>

      <div
        className={`feed-post-media${video ? ' is-video' : ' is-image'}${openable ? ' feed-post-media-openable' : ''}`}
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
      >
        <span className="feed-post-type-badge">{video ? 'VIDEO' : 'IMAGE'}</span>
        {thumb ? (
          <img src={thumb} alt="" loading="lazy" />
        ) : (
          <span className="feed-post-media-empty">Đang xử lý…</span>
        )}
        {video && (
          <span className="feed-post-play">
            <Play size={22} fill="currentColor" />
          </span>
        )}
        {item.duration && Number(item.duration) > 0 && (
          <span className="feed-post-duration">{item.duration}s</span>
        )}
      </div>

      {prompt && <p className="feed-post-prompt">{prompt}</p>}

      <footer className="feed-post-foot">
        <div className="feed-post-social">
          <button
            type="button"
            className={`feed-post-icon-btn${fav ? ' fav-on' : ''}`}
            aria-label={fav ? 'Bỏ yêu thích' : 'Yêu thích'}
            onClick={onHeart}
          >
            <Heart size={18} fill={fav ? 'currentColor' : 'none'} />
            <span>{fav ? Math.max(likes, 1) : likes}</span>
          </button>
          <button type="button" className="feed-post-icon-btn" aria-label="Bình luận">
            <MessageCircle size={18} />
            <span>{comments}</span>
          </button>
          <button
            type="button"
            className="feed-post-icon-btn"
            aria-label="Chia sẻ"
            onClick={() => void share()}
          >
            <Share2 size={18} />
          </button>
        </div>
        <div className="feed-post-actions">
          <button type="button" className="feed-post-text-btn">
            <Wand2 size={13} /> Remix
          </button>
          {(media || thumb) && (
            <button
              type="button"
              className="feed-post-text-btn"
              onClick={() => void downloadMediaUrl(media || thumb || '')}
            >
              <Download size={13} /> Tải về
            </button>
          )}
        </div>
      </footer>
    </article>
  );
}
