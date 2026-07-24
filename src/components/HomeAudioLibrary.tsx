import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Download,
  ExternalLink,
  MoreVertical,
  Play,
  Trash2,
  Volume2,
} from 'lucide-react';
import {
  feedMediaUrl,
  type FeedItem,
} from '../services/feedApi';
import {
  feedModelDisplay,
  formatFileSize,
} from '../services/feedLibraryMeta';
import { downloadMediaUrl } from '../utils/downloadMedia';
import HomeLibLayoutSwitcher, { type HomeLibLayout } from './HomeLibLayoutSwitcher';

const STORAGE_KEY = 'home_audio_lib_layout';

function formatDuration(raw?: string): string {
  if (!raw) return '';
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n >= 60) {
    const m = Math.floor(n / 60);
    const s = Math.round(n % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  return `${n < 10 ? n.toFixed(n < 1 ? 3 : 2) : n.toFixed(1)}s`;
}

function Waveform() {
  const bars = useMemo(
    () => Array.from({ length: 28 }, (_, i) => 28 + ((i * 17) % 52)),
    [],
  );
  return (
    <span className="home-audio-wave" aria-hidden>
      {bars.map((h, i) => (
        <span key={i} style={{ height: `${h}%` }} />
      ))}
    </span>
  );
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

function AudioRow({
  item,
  layout,
  selected,
  playing,
  menuOpen,
  onToggleSelect,
  onPlay,
  onToggleMenu,
  onCloseMenu,
  onDelete,
}: {
  item: FeedItem;
  layout: HomeLibLayout;
  selected: boolean;
  playing: boolean;
  menuOpen: boolean;
  onToggleSelect: () => void;
  onPlay: () => void;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onDelete?: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const media = feedMediaUrl(item);
  const title = (item.prompt || item.title || 'Âm thanh AI').trim();
  const model = feedModelDisplay(item);
  const size = formatFileSize(item.file_size);
  const duration = formatDuration(item.duration);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onCloseMenu();
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen, onCloseMenu]);

  const share = async () => {
    if (!media) return;
    if (navigator.share) {
      try {
        await navigator.share({ url: media, title });
        onCloseMenu();
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
    onCloseMenu();
  };

  return (
    <li
      className={`home-audio-row home-audio-row--${layout}${selected ? ' selected' : ''}${playing ? ' playing' : ''}`}
    >
      <button
        type="button"
        className={`home-audio-check${selected ? ' on' : ''}`}
        aria-label={selected ? 'Bỏ chọn' : 'Chọn'}
        onClick={onToggleSelect}
      >
        {selected ? <Check size={14} /> : null}
      </button>

      <button
        type="button"
        className="home-audio-play"
        aria-label="Phát"
        disabled={!media}
        onClick={onPlay}
      >
        <Play size={14} fill="currentColor" />
      </button>

      <div className="home-audio-text">
        <p className="home-audio-title" title={title}>
          {title}
        </p>
        <p className="home-audio-meta">
          {[model || 'AI Audio', size].filter(Boolean).join(' · ')}
        </p>
      </div>

      {(layout === 'list' || layout === 'wide') && <Waveform />}

      {duration && <span className="home-audio-duration">{duration}</span>}

      <div className="home-audio-hover-actions">
        {media && (
          <>
            <button
              type="button"
              className="home-audio-action"
              aria-label="Tải xuống"
              title="Tải xuống"
              onClick={() => void downloadMediaUrl(media)}
            >
              <Download size={14} />
            </button>
            <button
              type="button"
              className="home-audio-action"
              aria-label="Chia sẻ"
              title="Chia sẻ"
              onClick={() => void share()}
            >
              <ExternalLink size={14} />
            </button>
          </>
        )}
        {onDelete && (
          <button
            type="button"
            className="home-audio-action danger"
            aria-label="Xóa"
            title="Xóa"
            onClick={onDelete}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <div className="home-audio-more-wrap" ref={menuRef}>
        <button
          type="button"
          className="home-audio-more"
          aria-label="Tùy chọn"
          aria-expanded={menuOpen}
          onClick={onToggleMenu}
        >
          <MoreVertical size={16} />
        </button>
        {menuOpen && (
          <div className="home-audio-menu">
            {media && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    void downloadMediaUrl(media);
                    onCloseMenu();
                  }}
                >
                  <Download size={14} /> Tải xuống
                </button>
                <button type="button" onClick={() => void share()}>
                  <ExternalLink size={14} /> Chia sẻ
                </button>
              </>
            )}
            {onDelete && (
              <button
                type="button"
                className="danger"
                onClick={() => {
                  onDelete();
                  onCloseMenu();
                }}
              >
                <Trash2 size={14} /> Xóa
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

export default function HomeAudioLibrary({
  items,
  playingId,
  onPlay,
  onDelete,
}: {
  items: FeedItem[];
  playingId?: string | null;
  onPlay: (item: FeedItem) => void;
  onDelete?: (item: FeedItem) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menuId, setMenuId] = useState<string | null>(null);
  const [layout, setLayout] = useState<HomeLibLayout>(readLayout);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, layout);
    } catch {
      /* ignore */
    }
  }, [layout]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section className="home-audio-lib">
      <header className="home-lib-head">
        <div className="home-lib-head-left">
          <span className="home-lib-icon home-lib-icon--audio">
            <Volume2 size={16} />
          </span>
          <div>
            <h2 className="home-lib-title">Voice & SFX Library</h2>
            <p className="home-lib-count">{items.length} generations</p>
          </div>
        </div>
        <HomeLibLayoutSwitcher value={layout} onChange={setLayout} />
      </header>

      <ul className={`home-audio-list home-audio-list--${layout}`}>
        {items.map((item) => (
          <AudioRow
            key={item.id_base}
            item={item}
            layout={layout}
            selected={selected.has(item.id_base)}
            playing={playingId === item.id_base}
            menuOpen={menuId === item.id_base}
            onToggleSelect={() => toggle(item.id_base)}
            onPlay={() => onPlay(item)}
            onToggleMenu={() =>
              setMenuId((cur) => (cur === item.id_base ? null : item.id_base))
            }
            onCloseMenu={() => setMenuId(null)}
            onDelete={onDelete ? () => onDelete(item) : undefined}
          />
        ))}
      </ul>
    </section>
  );
}
