import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ComposerLibraryPreviewModal, {
  type ComposerPreviewHandlers,
} from './ComposerLibraryPreviewModal';
import FeedPostCard from './FeedPostCard';
import type { FeedItem } from '../services/feedApi';
import { feedIsAudioItem } from '../services/feedApi';
import { loadFavoriteItems } from '../services/feedFavoritesStore';
import {
  canOpenFeedPreview,
  feedPreviewKind,
  navigateFeedItemReuse,
} from '../utils/feedItemReuse';

export default function HomeFavoritesFeed() {
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

  const visualItems = useMemo(
    () => items.filter((it) => !feedIsAudioItem(it) && canOpenFeedPreview(it)),
    [items],
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

  return (
    <div className="home-feed home-feed--column">
      <div className="home-feed-column">
        {items.map((item) => (
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

      {!items.length && (
        <p className="muted feed-status">
          Chưa có mục yêu thích. Bấm ♥ trên Bảng tin hoặc thư viện để lưu vào đây.
        </p>
      )}
    </div>
  );
}
