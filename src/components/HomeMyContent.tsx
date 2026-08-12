import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FeedMasonryCard from './FeedMasonryCard';
import ComposerLibraryPreviewModal, {
  type ComposerPreviewHandlers,
} from './ComposerLibraryPreviewModal';
import HomeAudioLibrary from './HomeAudioLibrary';
import HomeMusicLibrary from './HomeMusicLibrary';
import { useCreditsUpdated } from '../hooks/useCreditsUpdated';
import { isLoggedIn } from '../services/authStore';
import { studioRouteForType } from '../constants/studioTypes';
import type { JobType } from '../services/api';
import {
  deleteFeedPost,
  feedIsAudioItem,
  feedIsDisplayable,
  feedMediaUrl,
  fetchMyAudio,
  fetchMyImages,
  fetchMyMusic,
  fetchMyVideos,
  invalidateMineAudioMusicCaches,
  type FeedItem,
  type MinePage,
} from '../services/feedApi';
import {
  loadFavorites,
} from '../services/feedFavoritesStore';
import { UpstreamMeError } from '../services/upstreamMe';
import { isFeedItemProcessing } from '../utils/feedProcessing';
import {
  matchesLibraryStatusFilter,
  type LibraryStatusFilter,
} from '../utils/feedLibraryStatus';
import { useLocale } from '../i18n';
import HomeFeedEmpty from './home/HomeFeedEmpty';

export type MineFilter = 'all' | 'video' | 'image' | 'music' | 'tts' | 'favorite';

function mineTime(item: FeedItem): number {
  const v = item.created_time;
  const n = typeof v === 'string' ? Number(v) : v ?? 0;
  return Number.isFinite(n) ? Number(n) : 0;
}

function previewKind(item: FeedItem): 'image' | 'video' {
  return item.type === 'image' ? 'image' : 'video';
}

function itemJobType(item: FeedItem): JobType {
  const t = (item.type || '').toLowerCase();
  if (t === 'music') return 'music';
  if (t === 'tts' || t.includes('audio')) return 'tts';
  if (t === 'image') return 'image';
  if (t === 'avatar-lipsync') return 'avatar-lipsync';
  return 'video';
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

export default function HomeMyContent({
  filter,
  statusFilter = 'all',
}: {
  filter: MineFilter;
  statusFilter?: LibraryStatusFilter;
}) {
  const { t } = useLocale();
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
  const refreshingRef = useRef(false);
  const [discoveryActive, setDiscoveryActive] = useState(true);

  const refreshRecent = useCallback(async () => {
    if (!isLoggedIn() || refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      const sources = sourcesForFilter(filter);
      if (sources.includes('music') || sources.includes('tts')) {
        invalidateMineAudioMusicCaches();
      }
      const favIds = filter === 'favorite' ? loadFavorites() : null;
      if (favIds && favIds.size === 0) return;

      const pages = await Promise.all(
        sources.map(async (source) => fetchSource(source, '', 30)),
      );

      const merged: FeedItem[] = [];
      for (const page of pages) {
        for (const it of page.items) {
          if (!it.id_base || !feedIsDisplayable(it)) continue;
          if (favIds && !favIds.has(it.id_base)) continue;
          seen.current.add(it.id_base);
          merged.push(it);
        }
      }

      if (!merged.length) return;

      setItems((prev) => {
        const byId = new Map(prev.map((it) => [it.id_base, it]));
        for (const it of merged) byId.set(it.id_base, it);
        return [...byId.values()].sort((a, b) => mineTime(b) - mineTime(a));
      });
    } catch {
      /* giữ danh sách cũ */
    } finally {
      refreshingRef.current = false;
    }
  }, [filter]);

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
    setDiscoveryActive(true);
    const id = window.setTimeout(() => setDiscoveryActive(false), 120_000);
    return () => window.clearTimeout(id);
  }, [filter]);

  const hasProcessing = useMemo(
    () => items.some(isFeedItemProcessing),
    [items],
  );

  useEffect(() => {
    if (!hasProcessing && !discoveryActive) return;
    const id = window.setInterval(() => {
      void refreshRecent();
    }, 4000);
    return () => window.clearInterval(id);
  }, [hasProcessing, discoveryActive, refreshRecent]);

  useCreditsUpdated(() => {
    void refreshRecent();
  });

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

  const displayItems = useMemo(
    () => items.filter((it) => matchesLibraryStatusFilter(it, statusFilter)),
    [items, statusFilter],
  );

  const visualItems = useMemo(
    () => displayItems.filter((it) => !feedIsAudioItem(it)),
    [displayItems],
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

  const emptyTitle = useMemo(() => {
    if (items.length > 0 && displayItems.length === 0) {
      if (statusFilter === 'success') return t('library.status.emptySuccess');
      if (statusFilter === 'failed') return t('library.status.emptyFailed');
    }
    if (filter === 'favorite') return 'Chưa có mục yêu thích';
    if (filter === 'music') return 'Chưa có bài nhạc';
    if (filter === 'tts') return 'Chưa có âm thanh';
    if (filter === 'video') return 'Chưa có video';
    if (filter === 'image') return 'Chưa có hình ảnh';
    return 'Thư viện trống';
  }, [items.length, displayItems.length, statusFilter, filter, t]);

  const emptyDescription =
    filter === 'favorite'
      ? 'Bấm ♥ trên sản phẩm trong bảng tin để lưu vào đây.'
      : 'Nội dung bạn tạo sẽ xuất hiện trong thư viện này.';

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
        items={displayItems}
        playingId={
          audioPlayerUrl
            ? displayItems.find((it) => feedMediaUrl(it) === audioPlayerUrl)?.id_base ?? null
            : null
        }
        onPlay={playAudioItem}
        onDelete={deleteLibraryItem}
      />
    ) : filter === 'music' ? (
      <HomeMusicLibrary
        items={displayItems}
        onPlay={playAudioItem}
        onDelete={deleteLibraryItem}
      />
    ) : (
      <div className="home-masonry home-masonry--library">
        {displayItems.map((item) => (
          <FeedMasonryCard
            key={item.id_base}
            item={item}
            hoverPreview={item.type !== 'image'}
            onOpen={() => openItem(item)}
            onFavoriteChange={() => setFavTick((n) => n + 1)}
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
      {!loading && !displayItems.length && !error && (
        <HomeFeedEmpty
          title={emptyTitle}
          description={emptyDescription}
          showCreate={filter !== 'favorite' && statusFilter === 'all'}
        />
      )}

      <div ref={sentinelRef} className="feed-sentinel" />
    </div>
  );
}
