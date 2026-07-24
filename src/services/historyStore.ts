import { authUserKey } from './authStore';

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

const LEGACY_STORAGE_KEY = 'ai_studio_history';
const MAX_PER_TYPE = 80;

export const JOB_TYPES: { value: HistoryType; label: string; icon: string }[] = [
  { value: 'video', label: 'Video', icon: '🎬' },
  { value: 'image', label: 'Hình ảnh', icon: '🖼️' },
  { value: 'tts', label: 'Giọng đọc', icon: '🔊' },
  { value: 'music', label: 'Nhạc AI', icon: '🎵' },
  { value: 'avatar-lipsync', label: 'Avatar nói', icon: '👤' },
];

function storageKey(): string {
  return `${LEGACY_STORAGE_KEY}:${authUserKey()}`;
}

function loadAll(): HistoryEntry[] {
  try {
    const key = storageKey();
    const raw = localStorage.getItem(key);
    if (raw) {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? (arr as HistoryEntry[]) : [];
    }

    // Một lần: chuyển lịch sử cũ (chung browser) sang user hiện tại.
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacyRaw) return [];
    const legacy = JSON.parse(legacyRaw);
    const entries = Array.isArray(legacy) ? (legacy as HistoryEntry[]) : [];
    if (entries.length) {
      localStorage.setItem(key, JSON.stringify(entries));
    }
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return entries;
  } catch {
    return [];
  }
}

function saveAll(entries: HistoryEntry[]): void {
  localStorage.setItem(storageKey(), JSON.stringify(entries));
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
