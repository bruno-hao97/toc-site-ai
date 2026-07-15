import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';
import {
  feedMediaUrl,
  feedThumb,
  fetchMyImages,
  fetchMyVideos,
  type FeedItem,
} from '../services/feedApi';
import { listHistory, type HistoryEntry } from '../services/historyStore';

type AlbumKind = 'image' | 'video';

interface AlbumItem {
  id: string;
  url: string;
  thumb: string;
  label?: string;
}

function historyToAlbum(entries: HistoryEntry[]): AlbumItem[] {
  return entries
    .filter((e) => Boolean(e.resultUrl))
    .map((e) => ({
      id: e.id,
      url: e.resultUrl,
      thumb: e.resultUrl,
      label: e.prompt?.slice(0, 40),
    }));
}

function feedToAlbum(items: FeedItem[]): AlbumItem[] {
  const out: AlbumItem[] = [];
  for (const item of items) {
    const url = feedMediaUrl(item);
    if (!url) continue;
    out.push({
      id: item.id_base || url,
      url,
      thumb: feedThumb(item) || url,
      label: item.prompt?.slice(0, 40),
    });
  }
  return out;
}

export default function ComposerMediaAlbumModal({
  open,
  kind,
  allowBoth = false,
  onClose,
  onSelect,
}: {
  open: boolean;
  kind: AlbumKind;
  allowBoth?: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
}) {
  const [tab, setTab] = useState<AlbumKind>(kind);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState<AlbumItem[]>([]);
  const [afterId, setAfterId] = useState('');
  const [hasMore, setHasMore] = useState(false);

  const activeKind = allowBoth ? tab : kind;

  const localItems = useMemo(() => {
    const entries = listHistory();
    const filtered =
      activeKind === 'image'
        ? entries.filter((e) => e.type === 'image')
        : entries.filter((e) => e.type === 'video' || e.type === 'avatar-lipsync');
    return historyToAlbum(filtered);
  }, [activeKind, open]);

  const loadPage = useCallback(
    async (reset: boolean) => {
      const fetcher = activeKind === 'image' ? fetchMyImages : fetchMyVideos;
      if (reset) {
        setLoading(true);
        setError('');
        setItems([]);
        setAfterId('');
      } else {
        setLoadingMore(true);
      }
      try {
        const page = await fetcher({ limit: 30, afterId: reset ? '' : afterId });
        const mapped = feedToAlbum(page.items);
        setItems((prev) => (reset ? mapped : [...prev, ...mapped]));
        setAfterId(page.nextAfterId || '');
        setHasMore(Boolean(page.nextAfterId) && mapped.length > 0);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (reset) setError(msg);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [activeKind, afterId],
  );

  useEffect(() => {
    if (!open) return;
    setTab(kind);
  }, [open, kind]);

  useEffect(() => {
    if (!open) return;
    void loadPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeKind]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const merged = useMemo(() => {
    const seen = new Set<string>();
    const out: AlbumItem[] = [];
    for (const item of [...localItems, ...items]) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      out.push(item);
    }
    return out;
  }, [localItems, items]);

  if (!open) return null;

  return createPortal(
    <div className="cms-modal-backdrop" onClick={onClose}>
      <div className="cms-modal cms-album-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cms-modal-head">
          <h3>Chọn từ album</h3>
          <button type="button" className="cms-modal-close" aria-label="Đóng" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {allowBoth && (
          <div className="cms-album-tabs">
            <button
              type="button"
              className={tab === 'image' ? 'active' : ''}
              onClick={() => setTab('image')}
            >
              Ảnh
            </button>
            <button
              type="button"
              className={tab === 'video' ? 'active' : ''}
              onClick={() => setTab('video')}
            >
              Video
            </button>
          </div>
        )}

        {error && <p className="cms-modal-error">{error}</p>}

        <div className="cms-album-grid">
          {loading && merged.length === 0 ? (
            <p className="cms-album-empty">
              <Loader2 size={18} className="cms-spin" /> Đang tải album…
            </p>
          ) : merged.length === 0 ? (
            <p className="cms-album-empty">Chưa có {activeKind === 'image' ? 'ảnh' : 'video'} trong album.</p>
          ) : (
            merged.map((item) => (
              <button
                key={item.id}
                type="button"
                className="cms-album-item"
                title={item.label || item.url}
                onClick={() => {
                  onSelect(item.url);
                  onClose();
                }}
              >
                {activeKind === 'video' ? (
                  <video src={item.thumb} muted preload="metadata" />
                ) : (
                  <img src={item.thumb} alt="" loading="lazy" />
                )}
              </button>
            ))
          )}
        </div>

        {hasMore && !loading && (
          <button
            type="button"
            className="cms-album-more"
            disabled={loadingMore}
            onClick={() => void loadPage(false)}
          >
            {loadingMore ? 'Đang tải…' : 'Tải thêm'}
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
