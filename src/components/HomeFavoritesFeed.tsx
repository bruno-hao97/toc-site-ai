import { useCallback, useEffect, useState } from 'react';
import type { FeedItem } from '../services/feedApi';
import { loadFavoriteItems } from '../services/feedFavoritesStore';
import FeedPostCard from './FeedPostCard';

export default function HomeFavoritesFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);

  const refresh = useCallback(() => {
    setItems(loadFavoriteItems());
  }, []);

  useEffect(() => {
    refresh();
    document.addEventListener('favorites:updated', refresh);
    return () => document.removeEventListener('favorites:updated', refresh);
  }, [refresh]);

  return (
    <div className="home-feed home-feed--column">
      <div className="home-feed-column">
        {items.map((item) => (
          <FeedPostCard
            key={item.id_base}
            item={item}
            onFavoriteChange={refresh}
          />
        ))}
      </div>

      {!items.length && (
        <p className="muted feed-status">
          Chưa có mục yêu thích. Bấm ♥ trên Bảng tin hoặc thư viện để lưu vào đây.
        </p>
      )}
    </div>
  );
}
