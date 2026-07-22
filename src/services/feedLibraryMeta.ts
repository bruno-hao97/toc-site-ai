import type { FeedItem } from './feedApi';
import { feedModelLabel } from './feedApi';

export function formatModelLabel(model: string): string {
  const trimmed = model.trim();
  if (!trimmed) return '';
  return trimmed
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/Ai\b/g, 'AI')
    .replace(/Gen\b/g, 'Gen');
}

export function feedModelDisplay(item: FeedItem): string {
  return formatModelLabel(feedModelLabel(item));
}

export function feedResolutionLabel(item: FeedItem): string {
  const res = item.resolution?.trim();
  if (res && res !== 'unknow' && res !== 'unknown') return res;
  const r0 = item.resolutions?.[0];
  if (r0?.name?.trim()) return r0.name;
  if (r0?.value?.trim()) return r0.value;
  return '';
}

/**
 * Nhãn "Chất lượng" kiểu vmedia: tier (50 / Mini / HD), không phải pixel.
 * Pixel đi vào Kích thước.
 */
export function feedQualityLabel(item: FeedItem): string {
  const q = item.quality;
  if (q != null && String(q).trim() !== '') return String(q).trim();

  const mode = (item.mode || '').trim();
  if (mode && !/^\d+x\d+$/i.test(mode) && mode !== 'unknow' && mode !== 'unknown') {
    // mode kiểu standard/mini thường là chế độ, vẫn hữu ích làm chất lượng nếu không có quality
    if (/^(mini|standard|high|low|quality|hd|fhd|uhd|4k)/i.test(mode) || /^\d{1,3}$/.test(mode)) {
      return mode;
    }
  }
  const res = feedResolutionLabel(item);
  if (!res) return '';
  // Pixel dimension → không dùng làm chất lượng
  if (/^\d+\s*[x×]\s*\d+$/i.test(res) || /^\d{3,4}p$/i.test(res)) return '';
  // Số ngắn kiểu quality tier (vd 50)
  if (/^\d{1,3}$/.test(res)) return res;
  if (/^(hd|fhd|uhd|4k|8k|mini|standard|high|low|quality)/i.test(res)) return res;
  // Resolution kiểu "720" thuần thường là height — không hiện ở Chất lượng
  if (/^\d{3,4}$/.test(res)) return '';
  return res;
}

export function feedDimensionsLabel(item: FeedItem): string {
  const r0 = item.resolutions?.[0];
  if (r0?.width && r0?.height) return `${r0.width}×${r0.height}`;
  const res = feedResolutionLabel(item);
  const m = res.match(/^(\d+)\s*[x×]\s*(\d+)$/i);
  if (m) return `${m[1]}×${m[2]}`;
  // Một số API chỉ trả "720" / "960" → suy ra vuông
  if (/^\d{3,4}$/.test(res) && !feedQualityLabel(item)) {
    return `${res}×${res}`;
  }
  return '';
}

export function formatFileSize(bytes?: number): string {
  if (bytes == null || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function feedRatioLabel(item: FeedItem): string {
  const r = (item.ratio || '').trim();
  if (!r || r === 'unknown' || r === 'unknow') return '';
  return r;
}

export function feedSourceLabel(item: FeedItem): string {
  const sa = item.server_ai?.trim();
  if (sa) return sa;
  if (item.isMe) return 'Của tôi';
  return 'Tạo AI';
}

export function feedCategoryLabel(item: FeedItem): string {
  return item.category_name?.trim() || '';
}

export function feedCreatedDateLabel(item: FeedItem): string {
  if (item.created_time == null) return '';
  let ts = typeof item.created_time === 'string' ? Number(item.created_time) : item.created_time;
  if (!Number.isFinite(ts) || ts <= 0) return '';
  if (ts < 1e12) ts *= 1000;
  try {
    return new Date(ts).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

/** Ngày ngắn kiểu vmedia: "22-07". */
export function feedCreatedShortLabel(item: FeedItem): string {
  if (item.created_time == null) return '';
  let ts = typeof item.created_time === 'string' ? Number(item.created_time) : item.created_time;
  if (!Number.isFinite(ts) || ts <= 0) return '';
  if (ts < 1e12) ts *= 1000;
  try {
    const d = new Date(ts);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}-${month}`;
  } catch {
    return '';
  }
}

/** Thumbnail ảnh/object tham chiếu (icon sản phẩm góc phải). */
export function feedRefThumb(item: FeedItem): string | null {
  const fromImages = item.images?.[0]?.url?.trim();
  if (fromImages) return fromImages;
  const fromObjects = item.objects?.[0]?.url?.trim();
  if (fromObjects) return fromObjects;
  return null;
}

/** Nhãn tuổi nhóm ngày kiểu vmedia: "4 ngày trước". */
export function groupRelativeAgeLabel(d: Date): string {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfDay.getTime()) / 86_400_000);
  if (diffDays <= 0) return '';
  if (diffDays === 1) return '1 ngày trước';
  return `${diffDays} ngày trước`;
}

export function feedTimeAgo(value: string | number | undefined): string {
  if (value == null) return '';
  let ts = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(ts) || ts <= 0) return '';
  if (ts < 1e12) ts *= 1000;
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return new Date(ts).toLocaleDateString('vi-VN');
}
