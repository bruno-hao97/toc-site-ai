/** HEAD (hoặc GET range) để lấy Content-Length khi API không trả file_size. */
const cache = new Map<string, number>();

export async function probeFileSize(url: string): Promise<number | null> {
  const key = url.trim();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key)!;

  try {
    const head = await fetch(key, { method: 'HEAD', mode: 'cors' });
    const len = Number(head.headers.get('content-length') || 0);
    if (head.ok && Number.isFinite(len) && len > 0) {
      cache.set(key, len);
      return len;
    }
  } catch {
    // CORS / HEAD không hỗ trợ — thử GET range
  }

  try {
    const res = await fetch(key, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
      mode: 'cors',
    });
    const cr = res.headers.get('content-range');
    const m = cr?.match(/\/(\d+)\s*$/);
    if (m) {
      const len = Number(m[1]);
      if (Number.isFinite(len) && len > 0) {
        cache.set(key, len);
        return len;
      }
    }
    const len = Number(res.headers.get('content-length') || 0);
    if (Number.isFinite(len) && len > 0) {
      cache.set(key, len);
      return len;
    }
  } catch {
    // ignore
  }
  return null;
}
