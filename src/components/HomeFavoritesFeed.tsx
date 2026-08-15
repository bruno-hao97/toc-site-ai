import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocale } from '../i18n';
import ComposerLibraryPreviewModal, {
  type ComposerPreviewHandlers,
} from './ComposerLibraryPreviewModal';
import FeedPostCard from './FeedPostCard';
import type { FeedItem } from '../services/feedApi';
import { feedIsAudioItem } from '../services/feedApi';
import { loadFavoriteItems } from '../services/feedFavoritesStore';
import HomeFeedEmpty from './home/HomeFeedEmpty';
import {
  canOpenFeedPreview,
  feedPreviewKind,
  navigateFeedItemReuse,
} from '../utils/feedItemReuse';
import {
  matchesLibraryStatusFilter,
  type LibraryStatusFilter,
} from '../utils/feedLibraryStatus';

export default function HomeFavoritesFeed({
  statusFilter = 'success',
}: {
  statusFilter?: LibraryStatusFilter;
}) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const refresh = useCallback(() => {
    setItems(loadFavoriteItems());
  }, []);

  useEffect(() => {
    refresh();
    document.addEventListener('favorites:updated', refresh);
    return () => document.removeEventListener('favorites:updated', refresh);
  }, [refresh]);

  const displayItems = useMemo(
    () => items.filter((it) => matchesLibraryStatusFilter(it, statusFilter)),
    [items, statusFilter],
  );

  const visualItems = useMemo(
    () => displayItems.filter((it) => !feedIsAudioItem(it) && canOpenFeedPreview(it)),
    [displayItems],
  );
  const previewItem = previewIndex != null ? visualItems[previewIndex] : null;
  const previewKindValue = previewItem ? feedPreviewKind(previewItem) : 'video';

  const openItem = useCallback(
    (item: FeedItem) => {
      const idx = visualItems.findIndex((it) => it.id_base === item.id_base);
      if (idx >= 0) setPreviewIndex(idx);
    },
    [visualItems],
  );

  const previewHandlers = useMemo((): ComposerPreviewHandlers => {
    if (!previewItem) return {};
    const close = () => setPreviewIndex(null);
    const reuse = () => navigateFeedItemReuse(navigate, previewItem, close);
    return {
      onRegenerate: reuse,
      onReuse: reuse,
      onEdit: feedPreviewKind(previewItem) === 'video' ? reuse : undefined,
    };
  }, [previewItem, navigate]);

  const emptyTitle = useMemo(() => {
    if (items.length > 0 && displayItems.length === 0) {
      if (statusFilter === 'success') return t('library.status.emptySuccess');
      if (statusFilter === 'failed') return t('library.status.emptyFailed');
    }
    return 'Chưa có mục yêu thích';
  }, [items.length, displayItems.length, statusFilter, t]);

  return (
    <div className="home-feed home-feed--column">
      <div className="home-feed-column">
        {displayItems.map((item) => (
          <FeedPostCard
            key={item.id_base}
            item={item}
            onOpen={() => openItem(item)}
            onFavoriteChange={refresh}
          />
        ))}
      </div>

      {previewIndex != null && visualItems.length > 0 && (
        <ComposerLibraryPreviewModal
          items={visualItems}
          index={Math.min(previewIndex, visualItems.length - 1)}
          kind={previewKindValue}
          layout="home"
          onClose={() => setPreviewIndex(null)}
          onNavigate={setPreviewIndex}
          handlers={previewHandlers}
        />
      )}

      {!displayItems.length && (
        <HomeFeedEmpty
          title={emptyTitle}
          description="Bấm ♥ trên bảng tin hoặc thư viện để lưu vào đây."
          showCreate={false}
        />
      )}
    </div>
  );
}
