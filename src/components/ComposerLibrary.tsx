import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, RefreshCw, Search, X } from 'lucide-react';
import ComposerLibraryItem from './ComposerLibraryItem';
import ComposerLibraryPreviewModal, {
  type ComposerPreviewHandlers,
} from './ComposerLibraryPreviewModal';
import {
  deleteFeedPost,
  feedMediaUrl,
  feedModelLabel,
  feedThumb,
  fetchMyImages,
  fetchMyVideos,
  type FeedItem,
} from '../services/feedApi';
import { formatModelLabel } from '../services/feedLibraryMeta';
import type { JobType } from '../services/api';

type Kind = 'image' | 'video' | 'unsupported';

function jobKind(jobType: JobType): Kind {
  if (jobType === 'image') return 'image';
  if (jobType === 'video' || jobType === 'avatar-lipsync') return 'video';
  return 'unsupported';
}

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

interface KeyedItem {
  key: string;
  item: FeedItem;
}

export default function ComposerLibrary({
  jobType,
  zoom,
  refreshKey = 0,
  onCountChange,
  selectedIds,
  onToggleSelect,
  onVisibleIdsChange,
  onUrlMapChange,
  onItemDeleted,
  buildPreviewHandlers,
}: {
  jobType: JobType;
  zoom: number;
  refreshKey?: number;
  onCountChange?: (count: number) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onVisibleIdsChange?: (ids: string[]) => void;
  onUrlMapChange?: (map: Record<string, string>) => void;
  onItemDeleted?: (id: string) => void;
  buildPreviewHandlers?: (
    item: FeedItem,
    mediaUrl: string,
    onClosePreview: () => void,
    onDelete?: () => void,
  ) => ComposerPreviewHandlers;
}) {
  const kind = jobKind(jobType);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [afterId, setAfterId] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [query, setQuery] = useState('');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [modelFilter, setModelFilter] = useState('');
  const [ratioFilter, setRatioFilter] = useState('');
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState('');
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (after: string, reset: boolean) => {
      if (kind === 'unsupported') return;
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
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        if (reset) setHasMore(false);
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [kind],
  );

  useEffect(() => {
    setItems([]);
    setAfterId('');
    setHasMore(true);
    setQuery('');
    setModelFilter('');
    setRatioFilter('');
    setPreviewIndex(null);
    load('', true);
  }, [load]);

  useEffect(() => {
    if (!refreshKey) return;
    load('', true);
  }, [refreshKey, load]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingRef.current) {
          load(afterId, false);
        }
      },
      { rootMargin: '320px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [afterId, hasMore, load]);

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
      if (modelFilter && feedModelLabel(it) !== modelFilter) return false;
      if (ratioFilter && (it.ratio || '') !== ratioFilter) return false;
      if (!q) return true;
      return [it.prompt, it.model, it.id_base]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [items, query, modelFilter, ratioFilter]);

  useEffect(() => {
    onCountChange?.(filteredItems.length);
    const ids = filteredItems.map((it) => it.id_base).filter(Boolean);
    onVisibleIdsChange?.(ids);
    const urlMap: Record<string, string> = {};
    for (const it of filteredItems) {
      const id = it.id_base;
      const url = feedMediaUrl(it) || feedThumb(it);
      if (id && url) urlMap[id] = url;
    }
    onUrlMapChange?.(urlMap);
  }, [filteredItems, onCountChange, onVisibleIdsChange, onUrlMapChange]);

  const sortedItems = useMemo(() => {
    const list = [...filteredItems];
    list.sort((a, b) => {
      const ta = tsToDate(a.created_time)?.getTime() ?? 0;
      const tb = tsToDate(b.created_time)?.getTime() ?? 0;
      return sortDir === 'desc' ? tb - ta : ta - tb;
    });
    return list;
  }, [filteredItems, sortDir]);

  const groups = useMemo(() => {
    const map = new Map<string, KeyedItem[]>();
    sortedItems.forEach((item, i) => {
      const d = tsToDate(item.created_time);
      const label = d ? dayLabel(d) : 'Khác';
      const keyed: KeyedItem = {
        key: `${item.id_base || 'x'}__${item.created_time ?? ''}__${i}`,
        item,
      };
      const bucket = map.get(label);
      if (bucket) bucket.push(keyed);
      else map.set(label, [keyed]);
    });
    return [...map.entries()];
  }, [sortedItems]);

  const flatIndexByKey = useMemo(() => {
    const map = new Map<string, number>();
    sortedItems.forEach((item, i) => {
      map.set(item.id_base, i);
    });
    return map;
  }, [sortedItems]);

  const handleDelete = useCallback(
    async (idBase: string) => {
      if (!idBase || deletingId) return;
      if (!window.confirm('Xóa mục này khỏi thư viện?')) return;
      setDeletingId(idBase);
      try {
        await deleteFeedPost(idBase);
        setItems((prev) => prev.filter((it) => it.id_base !== idBase));
        onItemDeleted?.(idBase);
        setPreviewIndex((prev) => {
          if (prev == null) return null;
          const deletedIndex = filteredItems.findIndex((it) => it.id_base === idBase);
          if (deletedIndex < 0) return prev;
          if (prev === deletedIndex) return null;
          if (prev > deletedIndex) return prev - 1;
          return prev;
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setDeletingId('');
      }
    },
    [deletingId, filteredItems, onItemDeleted],
  );

  if (kind === 'unsupported') {
    return (
      <div className="clib-status">
        Thư viện hiện hỗ trợ ảnh và video. Hãy chuyển sang tab Ảnh hoặc Video.
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className="clib-status clib-error">
        <p>Không tải được thư viện: {error}</p>
        <button type="button" className="composer-ghost-btn" onClick={() => load('', true)}>
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="clib-wrap">
      <div className="clib-toolbar">
        <div className="clib-search">
          <Search size={15} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm kiếm…"
          />
          {query && (
            <button
              type="button"
              className="clib-search-clear"
              aria-label="Xóa tìm kiếm"
              onClick={() => setQuery('')}
            >
              <X size={14} />
            </button>
          )}
        </div>
        <select
          className="clib-filter"
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
        <select
          className="clib-filter"
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
        <div className="clib-sort">
          <button
            type="button"
            className={sortDir === 'desc' ? 'active' : ''}
            onClick={() => setSortDir('desc')}
          >
            Mới
          </button>
          <button
            type="button"
            className={sortDir === 'asc' ? 'active' : ''}
            onClick={() => setSortDir('asc')}
          >
            Cũ
          </button>
        </div>
        <button
          type="button"
          className="clib-refresh"
          aria-label="Làm mới"
          disabled={loading}
          onClick={() => load('', true)}
        >
          <RefreshCw size={15} className={loading ? 'clib-spin' : ''} />
        </button>
      </div>

      {loading && items.length === 0 && (
        <div className="clib-status">
          <Loader2 size={18} className="clib-spin" /> Đang tải thư viện…
        </div>
      )}

      {!loading && filteredItems.length === 0 && (
        <div className="clib-status">
          {query || modelFilter || ratioFilter
            ? 'Không tìm thấy mục nào khớp.'
            : 'Chưa có tệp nào trong thư viện.'}
        </div>
      )}

      {groups.map(([label, list]) => (
        <section key={label} className="clib-group">
          <header className="clib-group-head">
            <span className="clib-group-label">{label}</span>
            <span className="clib-count">({list.length})</span>
          </header>
          <div className="clib-grid" style={{ ['--clib-thumb' as string]: `${zoom}px` }}>
            {list.map(({ key, item }) => {
              const itemId = item.id_base || key;
              const selected = selectedIds?.has(itemId) ?? false;
              const flatIndex = flatIndexByKey.get(item.id_base) ?? 0;
              return (
                <ComposerLibraryItem
                  key={key}
                  item={item}
                  kind={kind}
                  selected={selected}
                  onToggleSelect={onToggleSelect ? () => onToggleSelect(itemId) : undefined}
                  onPreview={() => setPreviewIndex(flatIndex)}
                  onDelete={() => void handleDelete(item.id_base)}
                  deleting={deletingId === item.id_base}
                />
              );
            })}
          </div>
        </section>
      ))}

      {loading && items.length > 0 && (
        <div className="clib-status">
          <Loader2 size={16} className="clib-spin" /> Đang tải thêm…
        </div>
      )}
      <div ref={sentinelRef} className="clib-sentinel" />

      {previewIndex != null && kind !== 'unsupported' && (
        <ComposerLibraryPreviewModal
          items={sortedItems}
          index={previewIndex}
          kind={kind}
          onClose={() => setPreviewIndex(null)}
          onNavigate={setPreviewIndex}
          handlers={
            buildPreviewHandlers
              ? buildPreviewHandlers(
                  sortedItems[previewIndex],
                  feedMediaUrl(sortedItems[previewIndex]) ||
                    feedThumb(sortedItems[previewIndex]) ||
                    '',
                  () => setPreviewIndex(null),
                  () => {
                    const item = sortedItems[previewIndex];
                    if (item?.id_base) void handleDelete(item.id_base);
                  },
                )
              : {
                  onDelete: () => {
                    const item = sortedItems[previewIndex];
                    if (item?.id_base) void handleDelete(item.id_base);
                  },
                }
          }
          deleting={Boolean(
            sortedItems[previewIndex]?.id_base &&
              deletingId === sortedItems[previewIndex]?.id_base,
          )}
        />
      )}
    </div>
  );
}
