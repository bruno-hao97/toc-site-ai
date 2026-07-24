import { useEffect, useState } from 'react';
import { Download, ExternalLink, Music2, Play, Trash2 } from 'lucide-react';
import {
  feedMediaUrl,
  feedThumb,
  type FeedItem,
} from '../services/feedApi';
import { feedModelDisplay } from '../services/feedLibraryMeta';
import { downloadMediaUrl } from '../utils/downloadMedia';
import HomeLibLayoutSwitcher, { type HomeLibLayout } from './HomeLibLayoutSwitcher';

const STORAGE_KEY = 'home_music_lib_layout';

function formatDuration(raw?: string): string {
  if (!raw) return '';
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return '';
  const m = Math.floor(n / 60);
  const s = Math.round(n % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatBytes(bytes?: number): string {
  if (bytes == null || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}kb`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}mb`;
}

function readLayout(): HomeLibLayout {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'list' || v === 'wide' || v === 'grid2' || v === 'grid3') return v;
  } catch {
    /* ignore */
  }
  return 'list';
}

function MusicItem({
  item,
  layout,
  onPlay,
  onDelete,
}: {
  item: FeedItem;
  layout: HomeLibLayout;
  onPlay: (item: FeedItem) => void;
  onDelete?: (item: FeedItem) => void;
}) {
  const cover = feedThumb(item);
  const media = feedMediaUrl(item);
  const title = (item.prompt || item.title || 'Bản nhạc AI').trim();
  const subtitle = feedModelDisplay(item) || 'AI MUSIC';
  const duration = formatDuration(item.duration);
  const size = formatBytes(item.file_size);
  const metaBits = [duration ? `${Number(item.duration || 0).toFixed(0)}s` : '', size].filter(Boolean);

  const share = async () => {
    if (!media) return;
    if (navigator.share) {
      try {
        await navigator.share({ url: media, title });
        return;
      } catch {
        /* fall through */
      }
    }
    try {
      await navigator.clipboard.writeText(media);
    } catch {
      window.open(media, '_blank', 'noreferrer');
    }
  };

  return (
    <article className={`home-music-item home-music-item--${layout}`}>
      <button
        type="button"
        className="home-music-cover-btn"
        onClick={() => onPlay(item)}
        disabled={!media}
        aria-label={`Phát ${title}`}
      >
        <span className="home-music-cover">
          {cover ? (
            <img src={cover} alt="" loading="lazy" />
          ) : (
            <Music2 size={28} />
          )}
          <span className="home-music-cover-play">
            <Play size={18} fill="currentColor" />
          </span>
        </span>
      </button>

      <div className="home-music-info">
        <button
          type="button"
          className="home-music-text-btn"
          onClick={() => onPlay(item)}
          disabled={!media}
        >
          <span className="home-music-title" title={title}>
            {title}
          </span>
          <span className="home-music-sub" title={subtitle}>
            {subtitle}
          </span>
          <span className="home-music-tags">
            <span className="home-music-pill">AI MUSIC</span>
            {metaBits.length > 0 && (
              <span className="home-music-meta-bits">{metaBits.join(', ')}</span>
            )}
          </span>
        </button>
      </div>

      <div className="home-music-actions">
        {media && (
          <>
            <button
              type="button"
              className="home-music-action"
              aria-label="Tải xuống"
              title="Tải xuống"
              onClick={() => void downloadMediaUrl(media)}
            >
              <Download size={15} />
            </button>
            <button
              type="button"
              className="home-music-action"
              aria-label="Chia sẻ"
              title="Chia sẻ"
              onClick={() => void share()}
            >
              <ExternalLink size={15} />
            </button>
          </>
        )}
        {onDelete && (
          <button
            type="button"
            className="home-music-action danger"
            aria-label="Xóa"
            title="Xóa"
            onClick={() => onDelete(item)}
          >
            <Trash2 size={15} />
          </button>
        )}
        {duration && <span className="home-music-dur">{duration}</span>}
      </div>
    </article>
  );
}

export default function HomeMusicLibrary({
  items,
  onPlay,
  onDelete,
}: {
  items: FeedItem[];
  onPlay: (item: FeedItem) => void;
  onDelete?: (item: FeedItem) => void;
}) {
  const [layout, setLayout] = useState<HomeLibLayout>(readLayout);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, layout);
    } catch {
      /* ignore */
    }
  }, [layout]);

  return (
    <section className="home-music-lib">
      <header className="home-lib-head">
        <div className="home-lib-head-left">
          <span className="home-lib-icon home-lib-icon--music">
            <Music2 size={16} />
          </span>
          <div>
            <h2 className="home-lib-title">Music Library</h2>
            <p className="home-lib-count">
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </p>
          </div>
        </div>
        <HomeLibLayoutSwitcher value={layout} onChange={setLayout} />
      </header>

      <div className={`home-music-view home-music-view--${layout}`}>
        {items.map((item) => (
          <MusicItem
            key={item.id_base}
            item={item}
            layout={layout}
            onPlay={onPlay}
            onDelete={onDelete}
          />
        ))}
      </div>
    </section>
  );
}
