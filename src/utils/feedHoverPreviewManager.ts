const MAX_CONCURRENT = 5;

type PreviewEntry = {
  stop: () => void;
  lastUsed: number;
};

const active = new Map<string, PreviewEntry>();

function evictOldest(exceptId?: string) {
  let oldestId: string | null = null;
  let oldestTime = Infinity;

  for (const [id, entry] of active) {
    if (id === exceptId) continue;
    if (entry.lastUsed < oldestTime) {
      oldestTime = entry.lastUsed;
      oldestId = id;
    }
  }

  if (!oldestId) return;
  const entry = active.get(oldestId);
  entry?.stop();
  active.delete(oldestId);
}

/** Reserve a hover-preview slot. Evicts LRU preview when at capacity. */
export function requestFeedHoverPreview(id: string, stop: () => void): void {
  if (active.has(id)) {
    const entry = active.get(id)!;
    entry.stop = stop;
    entry.lastUsed = Date.now();
    return;
  }

  while (active.size >= MAX_CONCURRENT) {
    evictOldest(id);
    if (active.size < MAX_CONCURRENT) break;
    // All entries are `id` — shouldn't happen.
    break;
  }

  active.set(id, { stop, lastUsed: Date.now() });
}

export function releaseFeedHoverPreview(id: string): void {
  const entry = active.get(id);
  if (!entry) return;
  active.delete(id);
  entry.stop();
}
