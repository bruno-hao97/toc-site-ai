export type HistoryType = 'image' | 'video' | 'tts' | 'music' | 'avatar-lipsync';

export interface HistoryEntry {
  id: string;
  type: HistoryType;
  resultUrl: string;
  prompt?: string;
  modelName?: string;
  modelSlug?: string;
  createdAt: string;
  meta?: Record<string, string>;
}

export type HistoryMediaKind = 'image' | 'video' | 'audio' | 'file';

const STORAGE_KEY = 'ai_studio_history';
const MAX_PER_TYPE = 80;

export const JOB_TYPES: { value: HistoryType; label: string; icon: string }[] = [
  { value: 'video', label: 'Video', icon: '🎬' },
  { value: 'image', label: 'Hình ảnh', icon: '🖼️' },
  { value: 'tts', label: 'Giọng đọc', icon: '🔊' },
  { value: 'music', label: 'Nhạc AI', icon: '🎵' },
  { value: 'avatar-lipsync', label: 'Avatar nói', icon: '👤' },
];

function loadAll(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? (arr as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function saveAll(entries: HistoryEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function dispatchUpdated(detail?: HistoryEntry): void {
  document.dispatchEvent(new CustomEvent('history:updated', { detail }));
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function capPerType(entries: HistoryEntry[]): HistoryEntry[] {
  const counts: Partial<Record<HistoryType, number>> = {};
  const out: HistoryEntry[] = [];
  for (const e of entries) {
    const n = counts[e.type] ?? 0;
    if (n >= MAX_PER_TYPE) continue;
    counts[e.type] = n + 1;
    out.push(e);
  }
  return out;
}

export function addHistoryEntry(
  entry: Omit<HistoryEntry, 'id' | 'createdAt'> & Partial<Pick<HistoryEntry, 'id' | 'createdAt'>>,
): HistoryEntry {
  const item: HistoryEntry = {
    id: entry.id || newId(),
    type: entry.type,
    resultUrl: entry.resultUrl,
    prompt: entry.prompt || '',
    modelName: entry.modelName || '',
    modelSlug: entry.modelSlug || '',
    createdAt: entry.createdAt || new Date().toISOString(),
    meta: entry.meta || {},
  };

  const dedupeKey = `${item.type}::${item.resultUrl}`;
  const rest = loadAll().filter((e) => `${e.type}::${e.resultUrl}` !== dedupeKey);
  const merged = capPerType([item, ...rest].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  ));

  saveAll(merged);
  dispatchUpdated(item);
  return item;
}

export function listHistory(type?: HistoryType | null): HistoryEntry[] {
  const all = loadAll().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  if (!type) return all;
  return all.filter((e) => e.type === type);
}

export function countHistory(type: HistoryType): number {
  return listHistory(type).length;
}

export function countHistoryGrouped(): Record<HistoryType, number> {
  const counts = Object.fromEntries(JOB_TYPES.map((t) => [t.value, 0])) as Record<HistoryType, number>;
  for (const e of loadAll()) {
    if (e.type in counts) counts[e.type]++;
  }
  return counts;
}

export function removeHistoryEntry(id: string): void {
  saveAll(loadAll().filter((e) => e.id !== id));
  dispatchUpdated();
}

export function clearHistory(type?: HistoryType | null): void {
  if (!type) {
    saveAll([]);
  } else {
    saveAll(loadAll().filter((e) => e.type !== type));
  }
  dispatchUpdated();
}

export function isMediaUrl(url: string, type?: HistoryType): HistoryMediaKind {
  if (type === 'image') return 'image';
  if (type === 'video' || type === 'avatar-lipsync') return 'video';
  if (type === 'tts' || type === 'music') return 'audio';

  const lower = url.toLowerCase();
  if (/\.(png|jpe?g|webp|gif)(\?|$)/i.test(lower)) return 'image';
  if (/\.(mp4|webm|mov)(\?|$)/i.test(lower)) return 'video';
  if (/\.(mp3|wav|ogg|m4a)(\?|$)/i.test(lower)) return 'audio';
  return 'file';
}

export function isValidHistoryType(value: string | undefined): value is HistoryType {
  return JOB_TYPES.some((t) => t.value === value);
}

const FAV_KEY = 'ai_studio_favorites';

export function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? (arr as string[]) : []);
  } catch {
    return new Set();
  }
}

export function isFavorite(id: string): boolean {
  return loadFavorites().has(id);
}

export function toggleFavorite(id: string): void {
  const favs = loadFavorites();
  if (favs.has(id)) favs.delete(id);
  else favs.add(id);
  localStorage.setItem(FAV_KEY, JSON.stringify([...favs]));
  dispatchUpdated();
}
