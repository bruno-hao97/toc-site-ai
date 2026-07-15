export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function mediaKindFromUrl(url: string): 'image' | 'video' | 'audio' | 'unknown' {
  const u = url.toLowerCase();
  if (/\.(mp4|webm|mov|m4v)(\?|$)/.test(u)) return 'video';
  if (/\.(mp3|wav|ogg|m4a|aac)(\?|$)/.test(u)) return 'audio';
  if (/\.(jpe?g|png|gif|webp|bmp|svg|avif)(\?|$)/.test(u)) return 'image';
  if (/video|\/videos\//.test(u)) return 'video';
  if (/image|\/images\//.test(u)) return 'image';
  return 'unknown';
}

export function validateMediaUrl(
  url: string,
  expectedKind: 'image' | 'video' | 'any',
): string | null {
  const trimmed = url.trim();
  if (!trimmed) return 'Nhập URL media.';
  if (!isHttpUrl(trimmed)) return 'URL phải bắt đầu bằng http:// hoặc https://';

  const kind = mediaKindFromUrl(trimmed);
  if (kind === 'unknown' && expectedKind !== 'any') {
    return expectedKind === 'image'
      ? 'URL không giống ảnh — dùng link JPG/PNG/WebP.'
      : 'URL không giống video — dùng link MP4/WebM.';
  }
  if (kind === 'audio') return 'Không hỗ trợ URL audio.';
  if (expectedKind === 'image' && kind === 'video') return 'Cần URL ảnh.';
  if (expectedKind === 'video' && kind === 'image') return 'Cần URL video.';
  return null;
}
