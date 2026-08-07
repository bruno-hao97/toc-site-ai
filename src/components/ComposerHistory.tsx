import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  Check,
  CheckSquare,
  ChevronDown,
  Clock,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import ComposerSelectCircle from './ComposerSelectCircle';
import ComposerGalleryEmpty from './composer/ComposerGalleryEmpty';
import { useLocale } from '../i18n';
import {
  deleteFeedPost,
  feedDisplayJobId,
  feedMediaUrl,
  feedThumb,
  fetchMyImages,
  fetchMyVideos,
  type FeedItem,
} from '../services/feedApi';
import type { JobType } from '../services/api';
import { classifyGatewayStatus } from '../services/mediaGenerationStatus';
import { groupRelativeAgeLabel } from '../services/feedLibraryMeta';
import ProjectPicker from './ProjectPicker';
import type { ProjectItemType } from '../services/projectStore';

export interface ComposerPendingJob {
  id: string;
  prompt: string;
  status: 'processing' | 'failed';
  progress?: number;
}

function projectType(jobType: JobType): ProjectItemType {
  if (jobType === 'image') return 'image';
  if (jobType === 'video' || jobType === 'avatar-lipsync') return 'video';
  if (jobType === 'music') return 'music';
  return 'tts';
}

const SUCCESS_RE = /finish|success|done|complete/i;
const FAIL_RE = /error|fail|reject|cancel/i;

type Kind = 'image' | 'video' | 'unsupported';

function jobKind(jobType: JobType): Kind {
  if (jobType === 'image') return 'image';
  if (jobType === 'video' || jobType === 'avatar-lipsync') return 'video';
  return 'unsupported';
}

function blockUrls(item: FeedItem): string[] {
  const out: string[] = [];
  item.resolutions?.forEach((r) => r.url && out.push(r.url));
  item.images?.forEach((i) => i.url && out.push(i.url));
  item.objects?.forEach((i) => i.url && out.push(i.url));
  if (item.download_url) out.push(item.download_url);
  else if (item.thumbnail_url) out.push(item.thumbnail_url);
  return [...new Set(out)];
}

function blockCounts(item: FeedItem): { ok: number; fail: number } {
  if (item.resolutions && item.resolutions.length) {
    const ok = item.resolutions.filter(
      (r) => Boolean(r.url) || SUCCESS_RE.test(r.status || ''),
    ).length;
    return { ok, fail: item.resolutions.length - ok };
  }
  const hasMedia = blockUrls(item).length > 0;
  const ok = SUCCESS_RE.test(item.status || '') || hasMedia ? 1 : 0;
  const fail = FAIL_RE.test(item.status || '') ? 1 : 0;
  return { ok, fail };
}

function isFeedItemProcessing(item: FeedItem): boolean {
  if (FAIL_RE.test(item.status || '')) return false;
  const urls = blockUrls(item);
  if (SUCCESS_RE.test(item.status || '') && urls.length > 0) return false;
  if (classifyGatewayStatus(item.status, urls[0] || null) === 'running') return true;
  if (item.resolutions?.some((r) => classifyGatewayStatus(r.status, r.url) === 'running')) {
    return true;
  }
  const { ok } = blockCounts(item);
  return ok === 0 && urls.length === 0 && !FAIL_RE.test(item.status || '');
}

function tsToDate(value: string | number | undefined): Date | null {
  if (value == null) return null;
  let ts = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(ts) || ts <= 0) return null;
  if (ts < 1e12) ts *= 1000;
  return new Date(ts);
}

function dayLabel(d: Date, today: string, yesterday: string): string {
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return today;
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return yesterday;
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function renderMedia(url: string) {
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)) {
    return <video src={url} controls preload="metadata" className="chist-media" />;
  }
  if (/\.(mp3|wav|ogg|m4a)(\?|$)/i.test(url)) {
    return <audio src={url} controls className="chist-audio" />;
  }
  return <img src={url} loading="lazy" alt="" className="chist-media" />;
}

interface KeyedItem {
  key: string;
  item: FeedItem;
}

interface HistoryGroup {
  label: string;
  relative: string;
  groupDate: Date | null;
  items: KeyedItem[];
}

export default function ComposerHistory({
  jobType,
  zoom,
  pendingJobs = [],
  refreshKey = 0,
  onItemDeleted,
  onCountChange,
  onVisibleIdsChange,
  onUrlMapChange,
  selectedIds,
  onToggleSelect,
  onClearSelection,
}: {
  jobType: JobType;
  zoom: number;
  pendingJobs?: ComposerPendingJob[];
  refreshKey?: number;
  onItemDeleted?: (id: string) => void;
  onCountChange?: (count: number) => void;
  onVisibleIdsChange?: (ids: string[]) => void;
  onUrlMapChange?: (map: Record<string, string>) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onClearSelection?: () => void;
}) {
  const { t } = useLocale();
  const kind = jobKind(jobType);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [afterId, setAfterId] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [selectMode, setSelectMode] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (after: string, reset: boolean) => {
      if (kind === 'unsupported') return;
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      setError('');
      try {
        const fetcher = kind === 'image' ? fetchMyImages : fetchMyVideos;
        const page = await fetcher({ limit: 30, afterId: after });
        setItems((prev) => (reset ? page.items : [...prev, ...page.items]));
        setAfterId(page.nextAfterId);
        setHasMore(Boolean(page.nextAfterId) && page.items.length > 0);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setHasMore(false);
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
    setExpanded(new Set());
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
      { rootMargin: '240px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [afterId, hasMore, load]);

  const activePending = useMemo(
    () => pendingJobs.filter((p) => p.status === 'processing'),
    [pendingJobs],
  );

  const hasProcessingUpstream = useMemo(
    () => items.some(isFeedItemProcessing),
    [items],
  );

  useEffect(() => {
    if (activePending.length === 0 && !hasProcessingUpstream) return;
    const id = window.setInterval(() => {
      if (!loadingRef.current) load('', true);
    }, 4000);
    return () => window.clearInterval(id);
  }, [activePending.length, hasProcessingUpstream, load]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) =>
      [it.title, it.prompt, it.id_base, it.platform_job_id, it.model]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [items, query]);

  const sortedItems = useMemo(() => {
    const list = [...filteredItems];
    list.sort((a, b) => {
      const ta = tsToDate(a.created_time)?.getTime() ?? 0;
      const tb = tsToDate(b.created_time)?.getTime() ?? 0;
      return sortDir === 'desc' ? tb - ta : ta - tb;
    });
    return list;
  }, [filteredItems, sortDir]);

  const groups = useMemo((): HistoryGroup[] => {
    const map = new Map<string, HistoryGroup>();
    const today = t('date.today');
    const yesterday = t('date.yesterday');
    sortedItems.forEach((item, i) => {
      const d = tsToDate(item.created_time);
      const label = d ? dayLabel(d, today, yesterday) : t('date.other');
      const keyed: KeyedItem = {
        key: `${item.id_base || 'x'}__${item.created_time ?? ''}__${i}`,
        item,
      };
      const bucket = map.get(label);
      if (bucket) bucket.items.push(keyed);
      else {
        map.set(label, {
          label,
          relative: d ? groupRelativeAgeLabel(d) : '',
          groupDate: d,
          items: [keyed],
        });
      }
    });
    return [...map.values()];
  }, [sortedItems, t]);

  const displayCount = filteredItems.length;

  useEffect(() => {
    onCountChange?.(displayCount);
    const ids = sortedItems.map((it) => it.id_base).filter(Boolean);
    onVisibleIdsChange?.(ids);
    const urlMap: Record<string, string> = {};
    for (const it of sortedItems) {
      const id = it.id_base;
      const url = feedMediaUrl(it) || feedThumb(it);
      if (id && url) urlMap[id] = url;
    }
    onUrlMapChange?.(urlMap);
  }, [sortedItems, displayCount, onCountChange, onVisibleIdsChange, onUrlMapChange]);

  useEffect(() => {
    setSelectMode(false);
  }, [jobType, refreshKey]);

  function toggleSelectMode() {
    setSelectMode((prev) => {
      if (prev) onClearSelection?.();
      return !prev;
    });
  }

  const toggle = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleDelete = useCallback(async (idBase: string) => {
    if (!idBase || deletingId) return;
    if (!window.confirm(t('composer.history.deleteConfirm'))) return;
    setDeletingId(idBase);
    try {
      await deleteFeedPost(idBase);
      setItems((prev) => prev.filter((it) => it.id_base !== idBase));
      onItemDeleted?.(idBase);
      setExpanded((prev) => {
        const next = new Set(prev);
        for (const k of prev) {
          if (k.startsWith(`${idBase}__`)) next.delete(k);
        }
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeletingId('');
    }
  }, [deletingId, onItemDeleted, t]);

  if (kind === 'unsupported') {
    return (
      <div className="chist-status">{t('composer.history.unsupported')}</div>
    );
  }

  if (error && items.length === 0 && activePending.length === 0) {
    return (
      <div className="chist-status chist-error">
        <p>{t('composer.history.loadError')}: {error}</p>
        <button type="button" className="composer-ghost-btn" onClick={() => load('', true)}>
          {t('composer.action.retry')}
        </button>
      </div>
    );
  }

  const showLocalPendingSection = activePending.length > 0;
  const isFilteredEmpty =
    !loading && items.length > 0 && filteredItems.length === 0 && Boolean(query.trim());
  const isFullyEmpty =
    !loading && items.length === 0 && activePending.length === 0;

  return (
    <div className="chist-wrap">
      <div className="chist-toolbar">
        <div className="chist-search">
          <Search size={15} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('composer.history.searchPlaceholder')}
          />
          {query && (
            <button
              type="button"
              className="chist-search-clear"
              aria-label={t('composer.aria.clearSearch')}
              onClick={() => setQuery('')}
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="chist-sort">
          <button
            type="button"
            className={sortDir === 'desc' ? 'active' : ''}
            onClick={() => setSortDir('desc')}
          >
            {t('composer.sort.new')}
          </button>
          <button
            type="button"
            className={sortDir === 'asc' ? 'active' : ''}
            onClick={() => setSortDir('asc')}
          >
            {t('composer.sort.old')}
          </button>
        </div>
        <button
          type="button"
          className={`chist-select-btn${selectMode ? ' active' : ''}`}
          onClick={toggleSelectMode}
        >
          <CheckSquare size={15} />
          {t('composer.history.select')}
          {selectMode && selectedIds && selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
        </button>
        <button
          type="button"
          className="chist-refresh"
          aria-label={t('composer.aria.refreshHistory')}
          disabled={loading}
          onClick={() => load('', true)}
        >
          <RefreshCw size={15} className={loading ? 'chist-spin' : ''} />
        </button>
      </div>

      {loading && items.length === 0 && !showLocalPendingSection && (
        <div className="chist-status">
          <Loader2 size={18} className="chist-spin" /> {t('composer.history.loading')}
        </div>
      )}

      {isFullyEmpty && (
        <ComposerGalleryEmpty
          title={t('composer.history.emptyTitle')}
          description={t(
            jobType === 'video' || jobType === 'avatar-lipsync'
              ? 'composer.history.emptyHintVideo'
              : jobType === 'image'
                ? 'composer.history.emptyHintImage'
                : 'composer.history.emptyHint',
          )}
          focusLabel={t('composer.gallery.focusPanel')}
        />
      )}

      {isFilteredEmpty && (
        <ComposerGalleryEmpty
          title={t('composer.gallery.emptyFiltered')}
          showFocus={false}
        />
      )}

      {showLocalPendingSection && (
        <section className="chist-group">
          <header className="chist-group-head">
            <span className="chist-group-label">{t('date.today')}</span>
            <span className="chist-count">
              {t('composer.history.processingCount', { count: activePending.length })}
            </span>
          </header>
          <div className="chist-grid">
            {activePending.map((p) => {
              const name = (p.prompt || t('composer.noDescription')).trim();
              return (
                <div key={p.id} className="chist-block-cell">
                  <div className="chist-block chist-block-pending">
                    <div className="chist-block-head">
                      <span className="chist-name" title={name}>
                        {name}
                      </span>
                      <Loader2 size={16} className="chist-pending-spin" aria-label={t('composer.history.processing')} />
                    </div>
                    <div className="chist-pending-bar" role="progressbar" aria-valuenow={p.progress ?? 12}>
                      <div
                        className="chist-pending-bar-fill"
                        style={{ width: `${p.progress ?? 12}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {groups.map((group) => (
        <section key={group.label} className="chist-group">
          <header className="chist-group-head">
            <span className="chist-group-label">{group.label}</span>
            {group.relative && (
              <span className="chist-group-relative">{group.relative}</span>
            )}
            <span className="chist-count">({group.items.length})</span>
          </header>
          <div className="chist-grid">
            {group.items.map(({ key, item }) => {
              const open = expanded.has(key);
              const { ok, fail } = blockCounts(item);
              const processing = isFeedItemProcessing(item);
              const d = tsToDate(item.created_time);
              const name = (item.title || item.prompt || t('composer.noDescription')).trim();
              const displayId = feedDisplayJobId(item);
              const urls = open ? blockUrls(item) : [];
              const allUrls = blockUrls(item);
              const blockThumb = item.thumbnail_url || allUrls[0];
              return (
                <Fragment key={key}>
                  <div className="chist-block-cell">
                  {selectMode && !processing && item.id_base && onToggleSelect && (
                    <ComposerSelectCircle
                      selected={selectedIds?.has(item.id_base) ?? false}
                      onToggle={() => onToggleSelect(item.id_base)}
                    />
                  )}
                  {!selectMode && !processing && item.id_base && (
                    <div className="chist-block-actions">
                      <ProjectPicker
                        snapshot={{
                          itemId: item.id_base,
                          type: projectType(jobType),
                          prompt: name,
                          thumbnailUrl: blockThumb,
                          downloadUrl: allUrls[0] || blockThumb,
                          createdTime: item.created_time,
                        }}
                      />
                      <button
                        type="button"
                        className="chist-delete-btn"
                        aria-label={t('composer.aria.delete')}
                        disabled={deletingId === item.id_base}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDelete(item.id_base);
                        }}
                      >
                        {deletingId === item.id_base ? (
                          <Loader2 size={14} className="chist-pending-spin" />
                        ) : (
                          <Trash2 size={15} />
                        )}
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    className={`chist-block${open ? ' open' : ''}${processing ? ' chist-block-pending' : ''}`}
                    onClick={() => toggle(key)}
                  >
                    <div className="chist-block-head">
                      <span className="chist-name" title={name}>
                        {name}
                      </span>
                      {processing ? (
                        <Loader2 size={16} className="chist-pending-spin" aria-label={t('composer.history.processing')} />
                      ) : (
                        <ChevronDown size={15} className={`chist-caret${open ? ' open' : ''}`} />
                      )}
                    </div>
                    <div className="chist-meta">
                      {d && (
                        <span>
                          <Calendar size={12} />
                          {d.toLocaleDateString('vi-VN', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </span>
                      )}
                      {d && (
                        <span>
                          <Clock size={12} />
                          {d.toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>
                    <div className="chist-foot">
                      {processing ? (
                        <span className="chist-processing-label">{t('composer.history.processing')}</span>
                      ) : (
                        <>
                          <span className="chist-ok">
                            <Check size={13} />
                            {ok}
                          </span>
                          <span className="chist-fail">
                            <X size={13} />
                            {fail}
                          </span>
                        </>
                      )}
                      {displayId && <span className="chist-id">ID: {displayId}</span>}
                    </div>
                  </button>
                  </div>
                  {open && (
                    <div className="chist-images" style={{ ['--chist-thumb' as string]: `${zoom}px` }}>
                      {urls.length > 0 ? (
                        urls.map((u, i) => (
                          <a
                            key={`${key}-${i}`}
                            href={u}
                            target="_blank"
                            rel="noreferrer"
                            className="chist-img"
                          >
                            {renderMedia(u)}
                          </a>
                        ))
                      ) : (
                        <p className="chist-block-empty">{t('composer.history.blockEmpty')}</p>
                      )}
                    </div>
                  )}
                </Fragment>
              );
            })}
          </div>
        </section>
      ))}

      {loading && items.length > 0 && (
        <div className="chist-status">
          <Loader2 size={16} className="chist-spin" />
        </div>
      )}
      <div ref={sentinelRef} className="chist-sentinel" />
    </div>
  );
}
