import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  LayoutGrid,
  Loader2,
  Maximize2,
  Minimize2,
  RefreshCw,
  Search,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { getGommoClient, loadAuth } from '../../services/authStore';
import {
  feedMediaUrl,
  feedModelLabel,
  feedThumb,
  fetchMyImages,
  fetchMyVideos,
  type FeedItem,
} from '../../services/feedApi';
import {
  feedCategoryLabel,
  feedModelDisplay,
  feedSourceLabel,
  formatModelLabel,
} from '../../services/feedLibraryMeta';
import type { MediaInputKind } from '../../services/workflowMediaInput';

const MAX_SELECT = 50;
const RECENT_KEY = (kind: MediaInputKind) => `wf-lib-recent-${kind}`;

function tsToDate(value: string | number | undefined): Date | null {
  if (value == null) return null;
  let ts = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(ts) || ts <= 0) return null;
  if (ts < 1e12) ts *= 1000;
  return new Date(ts);
}

function dayLabel(d: Date): string {
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function timeLabel(value: string | number | undefined): string {
  const d = tsToDate(value);
  if (!d) return '';
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function itemLabel(item: FeedItem): string {
  return item.prompt?.trim() || feedModelDisplay(item) || item.id_base || '';
}

function readRecentIds(kind: MediaInputKind): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY(kind));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeRecentIds(kind: MediaInputKind, ids: string[]) {
  try {
    localStorage.setItem(RECENT_KEY(kind), JSON.stringify(ids.slice(0, 20)));
  } catch {
    /* ignore */
  }
}

interface Props {
  open: boolean;
  kind: MediaInputKind;
  initialUrls: string[];
  onConfirm: (urls: string[], fileNames: string[]) => void;
  onCancel: () => void;
}

export default function WorkflowMediaLibraryPicker({
  open,
  kind,
  initialUrls,
  onConfirm,
  onCancel,
}: Props) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [afterId, setAfterId] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [ratioFilter, setRatioFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [pendingUrls, setPendingUrls] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const accept = kind === 'image' ? 'image/*' : 'video/*';
  const mediaWord = kind === 'image' ? 'ảnh' : 'video';
  const title = kind === 'image' ? 'Chọn ảnh từ thư viện' : 'Chọn video từ thư viện';

  const load = useCallback(
    async (after: string, reset: boolean) => {
      if (!loadAuth()?.access_token) {
        setError('Cần đăng nhập để xem thư viện.');
        setItems([]);
        setHasMore(false);
        return;
      }
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      if (reset) setError('');
      try {
        const fetcher = kind === 'image' ? fetchMyImages : fetchMyVideos;
        const page = await fetcher({ limit: 30, afterId: after });
        setItems((prev) => (reset ? page.items : [...prev, ...page.items]));
        setAfterId(page.nextAfterId);
        setHasMore(Boolean(page.nextAfterId) && page.items.length > 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        if (reset) {
          setItems([]);
          setHasMore(false);
        }
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [kind],
  );

  useEffect(() => {
    if (!open) return;
    setPendingUrls(new Set(initialUrls));
    setQuery('');
    setSourceFilter('');
    setCategoryFilter('');
    setRatioFilter('');
    setModelFilter('');
    setExpanded(false);
  }, [open, kind, initialUrls]);

  useEffect(() => {
    if (!open) return;
    setItems([]);
    setAfterId('');
    setHasMore(true);
    void load('', true);
  }, [open, kind, refreshKey, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !open) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingRef.current) {
          void load(afterId, false);
        }
      },
      { rootMargin: '320px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [open, afterId, hasMore, load]);

  const sources = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      const s = feedSourceLabel(it);
      if (s) set.add(s);
    });
    return [...set].sort();
  }, [items]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      const c = feedCategoryLabel(it);
      if (c) set.add(c);
    });
    return [...set].sort();
  }, [items]);

  const models = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      const m = feedModelLabel(it);
      if (m) set.add(m);
    });
    return [...set].sort();
  }, [items]);

  const ratios = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      const r = (it.ratio || '').trim();
      if (r && r !== 'unknown' && r !== 'unknow') set.add(r);
    });
    return [...set].sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      const url = feedMediaUrl(it);
      if (!url) return false;
      if (sourceFilter && feedSourceLabel(it) !== sourceFilter) return false;
      if (categoryFilter && feedCategoryLabel(it) !== categoryFilter) return false;
      if (ratioFilter && (it.ratio || '') !== ratioFilter) return false;
      if (modelFilter && feedModelLabel(it) !== modelFilter) return false;
      if (!q) return true;
      return [it.prompt, feedModelLabel(it), it.id_base]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [items, query, sourceFilter, categoryFilter, ratioFilter, modelFilter]);

  const recentItems = useMemo(() => {
    const ids = readRecentIds(kind);
    const byId = new Map(items.map((it) => [it.id_base, it]));
    return ids.map((id) => byId.get(id)).filter((it): it is FeedItem => Boolean(it));
  }, [items, kind]);

  const groups = useMemo(() => {
    const map = new Map<string, FeedItem[]>();
    for (const item of filteredItems) {
      const d = tsToDate(item.created_time);
      const label = d ? dayLabel(d) : 'Khác';
      const list = map.get(label) ?? [];
      list.push(item);
      map.set(label, list);
    }
    return [...map.entries()];
  }, [filteredItems]);

  const toggleUrl = (url: string) => {
    setPendingUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) {
        next.delete(url);
      } else if (next.size < MAX_SELECT) {
        next.add(url);
      }
      return next;
    });
  };

  const resetFilters = () => {
    setQuery('');
    setSourceFilter('');
    setCategoryFilter('');
    setRatioFilter('');
    setModelFilter('');
    setRefreshKey((k) => k + 1);
  };

  const handleUpload = async (files: FileList | null) => {
    const list = files ? Array.from(files) : [];
    if (!list.length) return;
    if (!loadAuth()?.access_token) {
      setError('Cần đăng nhập để upload');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const client = getGommoClient();
      for (const file of list) {
        const valid =
          kind === 'image'
            ? file.type.startsWith('image/')
            : file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(file.name);
        if (!valid) continue;
        const { url } =
          kind === 'image' ? await client.uploadImage(file) : await client.uploadVideo(file);
        setPendingUrls((prev) => {
          const next = new Set(prev);
          if (next.size < MAX_SELECT) next.add(url);
          return next;
        });
      }
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleConfirm = () => {
    const urls = [...pendingUrls];
    const fileNames = urls.map((url) => {
      const item = items.find((it) => feedMediaUrl(it) === url);
      return item ? itemLabel(item) : url;
    });
    const recentIds = items
      .filter((it) => {
        const url = feedMediaUrl(it);
        return url && pendingUrls.has(url);
      })
      .map((it) => it.id_base)
      .filter(Boolean);
    if (recentIds.length) writeRecentIds(kind, recentIds);
    onConfirm(urls, fileNames);
  };

  const renderCard = (item: FeedItem) => {
    const url = feedMediaUrl(item);
    if (!url) return null;
    const thumb = feedThumb(item) || url;
    const selected = pendingUrls.has(url);
    const model = feedModelDisplay(item);
    return (
      <button
        key={item.id_base}
        type="button"
        className={`wf-lib-picker-card${selected ? ' is-selected' : ''}`}
        onClick={() => toggleUrl(url)}
        title={item.prompt || model || url}
      >
        <div className="wf-lib-picker-card-media">
          {kind === 'image' ? (
            <img src={thumb} alt="" loading="lazy" />
          ) : (
            <video src={thumb} muted preload="metadata" />
          )}
          {selected && (
            <span className="wf-lib-picker-card-check">
              <Check size={14} />
            </span>
          )}
        </div>
        <div className="wf-lib-picker-card-meta">
          <span className="wf-lib-picker-card-time">{timeLabel(item.created_time)}</span>
          {model && <span className="wf-lib-picker-card-model">{model}</span>}
        </div>
      </button>
    );
  };

  if (!open) return null;

  const selectedCount = pendingUrls.size;

  return createPortal(
    <div
      className={`wf-lib-picker-overlay${expanded ? ' is-expanded' : ''}`}
      onClick={onCancel}
    >
      <div className="wf-lib-picker" onClick={(e) => e.stopPropagation()}>
        <header className="wf-lib-picker-head">
          <div>
            <h2>{title}</h2>
            <p>
              {filteredItems.length} {mediaWord} · Đã chọn: {selectedCount} / {MAX_SELECT}
            </p>
          </div>
          <div className="wf-lib-picker-head-actions">
            <button
              type="button"
              className="wf-lib-picker-icon-btn"
              title="Lưới"
              aria-label="Lưới"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              type="button"
              className="wf-lib-picker-action-btn"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={14} />
              Tải lên
            </button>
            {kind === 'image' && (
              <a
                href="/image"
                target="_blank"
                rel="noopener noreferrer"
                className="wf-lib-picker-action-btn"
              >
                <Sparkles size={14} />
                Tạo ảnh mới
              </a>
            )}
            <button
              type="button"
              className="wf-lib-picker-icon-btn"
              title={expanded ? 'Thu nhỏ' : 'Phóng to'}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              type="button"
              className="wf-lib-picker-icon-btn"
              title="Reset"
              onClick={resetFilters}
            >
              <RefreshCw size={16} />
            </button>
            <button type="button" className="wf-lib-picker-icon-btn" title="Đóng" onClick={onCancel}>
              <X size={16} />
            </button>
          </div>
        </header>

        <input
          ref={fileRef}
          type="file"
          accept={accept}
          multiple
          className="sr-only"
          onChange={(e) => void handleUpload(e.target.files)}
        />

        <div className="wf-lib-picker-toolbar">
          <div className="wf-lib-picker-search">
            <Search size={15} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={kind === 'image' ? 'Tìm kiếm theo prompt…' : 'Tìm kiếm video…'}
            />
            {query && (
              <button type="button" className="wf-lib-picker-search-clear" onClick={() => setQuery('')}>
                <X size={14} />
              </button>
            )}
          </div>
          <select
            className="wf-lib-picker-filter"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            aria-label="Lọc nguồn"
          >
            <option value="">Tất cả nguồn</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {kind === 'image' && (
            <select
              className="wf-lib-picker-filter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Lọc danh mục"
            >
              <option value="">Tất cả danh mục</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          <select
            className="wf-lib-picker-filter"
            value={ratioFilter}
            onChange={(e) => setRatioFilter(e.target.value)}
            aria-label="Lọc tỷ lệ"
          >
            <option value="">Tất cả tỷ lệ</option>
            {ratios.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            className="wf-lib-picker-filter"
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value)}
            aria-label="Lọc model"
          >
            <option value="">Tất cả Model</option>
            {models.map((m) => (
              <option key={m} value={m}>
                {formatModelLabel(m)}
              </option>
            ))}
          </select>
        </div>

        <div className="wf-lib-picker-body">
          {error && <p className="wf-lib-picker-error">{error}</p>}

          {loading && items.length === 0 ? (
            <p className="wf-lib-picker-empty">
              <Loader2 size={18} className="wf-spin" /> Đang tải thư viện…
            </p>
          ) : filteredItems.length === 0 ? (
            <p className="wf-lib-picker-empty">
              {query || sourceFilter || categoryFilter || ratioFilter || modelFilter
                ? 'Không tìm thấy kết quả.'
                : `Chưa có ${mediaWord} trong thư viện.`}
            </p>
          ) : (
            <>
              {kind === 'video' && recentItems.length > 0 && (
                <section className="wf-lib-picker-section">
                  <header className="wf-lib-picker-section-head">
                    <span>Dùng gần đây</span>
                    <span className="wf-lib-picker-section-count">{recentItems.length}</span>
                  </header>
                  <div className="wf-lib-picker-grid wf-lib-picker-grid--recent">
                    {recentItems.map((item) => renderCard(item))}
                  </div>
                </section>
              )}

              {groups.map(([label, list]) => (
                <section key={label} className="wf-lib-picker-section">
                  <header className="wf-lib-picker-section-head">
                    <span>{label}</span>
                    <span className="wf-lib-picker-section-count">{list.length}</span>
                  </header>
                  <div className="wf-lib-picker-grid">{list.map((item) => renderCard(item))}</div>
                </section>
              ))}
            </>
          )}

          {loading && items.length > 0 && (
            <p className="wf-lib-picker-loading-more">
              <Loader2 size={16} className="wf-spin" /> Đang tải thêm…
            </p>
          )}
          <div ref={sentinelRef} className="wf-lib-picker-sentinel" />
        </div>

        <footer className="wf-lib-picker-foot">
          <span className="wf-lib-picker-foot-hint">
            Đã chọn {selectedCount} / {MAX_SELECT} {mediaWord}
          </span>
          <div className="wf-lib-picker-foot-actions">
            <button type="button" className="wf-lib-picker-cancel" onClick={onCancel}>
              Hủy
            </button>
            <button type="button" className="wf-lib-picker-confirm" onClick={handleConfirm}>
              Xác nhận ({selectedCount})
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
