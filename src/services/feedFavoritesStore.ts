import type { FeedItem } from './feedApi';
import { authUserKey } from './authStore';

const LEGACY_FAV_IDS_KEY = 'ai_studio_favorites';
const LEGACY_FAV_ITEMS_KEY = 'ai_studio_favorite_items';

function favIdsKey(): string {
  return `${LEGACY_FAV_IDS_KEY}:${authUserKey()}`;
}

function favItemsKey(): string {
  return `${LEGACY_FAV_ITEMS_KEY}:${authUserKey()}`;
}

function dispatchFavoritesUpdated(): void {
  document.dispatchEvent(new CustomEvent('favorites:updated'));
}

function migrateLegacyIfNeeded(): void {
  try {
    if (localStorage.getItem(favIdsKey()) != null) return;
    const legacyIds = localStorage.getItem(LEGACY_FAV_IDS_KEY);
    const legacyItems = localStorage.getItem(LEGACY_FAV_ITEMS_KEY);
    if (legacyIds) {
      localStorage.setItem(favIdsKey(), legacyIds);
      localStorage.removeItem(LEGACY_FAV_IDS_KEY);
    }
    if (legacyItems) {
      localStorage.setItem(favItemsKey(), legacyItems);
      localStorage.removeItem(LEGACY_FAV_ITEMS_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function loadFavorites(): Set<string> {
  try {
    migrateLegacyIfNeeded();
    const raw = localStorage.getItem(favIdsKey());
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? (arr as string[]) : []);
  } catch {
    return new Set();
  }
}

function loadItemsMap(): Record<string, FeedItem> {
  try {
    migrateLegacyIfNeeded();
    const raw = localStorage.getItem(favItemsKey());
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === 'object' && !Array.isArray(obj)
      ? (obj as Record<string, FeedItem>)
      : {};
  } catch {
    return {};
  }
}

function saveIds(ids: Set<string>): void {
  localStorage.setItem(favIdsKey(), JSON.stringify([...ids]));
}

function saveItemsMap(map: Record<string, FeedItem>): void {
  localStorage.setItem(favItemsKey(), JSON.stringify(map));
}

export function loadFavoriteItems(): FeedItem[] {
  const ids = loadFavorites();
  const map = loadItemsMap();
  const out: FeedItem[] = [];
  for (const id of ids) {
    const item = map[id];
    if (item?.id_base) out.push(item);
  }
  // newest favorited first — map order is insertion; Set iterates insertion order
  return out.reverse();
}

export function isFavorite(id: string): boolean {
  return loadFavorites().has(id);
}

/** Bật/tắt yêu thích. Truyền `item` khi thêm để tab Yêu thích hiển thị lại được. */
export function toggleFavorite(id: string, item?: FeedItem): boolean {
  const key = id.trim();
  if (!key) return false;

  const favs = loadFavorites();
  const map = loadItemsMap();
  let nowFav = false;

  if (favs.has(key)) {
    favs.delete(key);
    delete map[key];
    nowFav = false;
  } else {
    favs.add(key);
    if (item) map[key] = { ...item, id_base: key };
    nowFav = true;
  }

  saveIds(favs);
  saveItemsMap(map);
  dispatchFavoritesUpdated();
  return nowFav;
}
