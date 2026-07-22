import type { GommoModel } from './api';

type PriceRow = {
  mode?: string;
  resolution?: string;
  duration?: string | number;
  price?: number;
};

function eq(a?: string, b?: string): boolean {
  return (a ?? '').toLowerCase() === (b ?? '').toLowerCase();
}

function formatPrice(price: number): string {
  return price.toLocaleString('vi-VN');
}

function rowDim(row: PriceRow, key: 'mode' | 'resolution' | 'duration'): string | null {
  const v = row[key];
  if (v == null || v === '') return null;
  return String(v);
}

/** Chiều giá là wildcard (null) hoặc khớp giá trị đang chọn. */
function dimMatches(row: PriceRow, key: 'mode' | 'resolution' | 'duration', value: string): boolean {
  const rowVal = rowDim(row, key);
  if (rowVal == null) return true;
  if (!value.trim()) return false;
  return eq(rowVal, value);
}

/** Bỏ qua hàng có duration khác selection (tránh fallback resolution-only sai). */
function durationOk(row: PriceRow, duration: string): boolean {
  const rowDuration = rowDim(row, 'duration');
  if (rowDuration == null) return true;
  if (!duration.trim()) return false;
  return eq(rowDuration, duration);
}

function findPriceRow(
  prices: PriceRow[],
  mode: string,
  resolution: string,
  duration: string,
): PriceRow | null {
  const predicates: Array<(p: PriceRow) => boolean> = [
    (p) =>
      durationOk(p, duration) &&
      dimMatches(p, 'mode', mode) &&
      dimMatches(p, 'resolution', resolution) &&
      dimMatches(p, 'duration', duration),
    (p) =>
      durationOk(p, duration) &&
      dimMatches(p, 'mode', mode) &&
      rowDim(p, 'resolution') == null &&
      dimMatches(p, 'duration', duration),
    (p) =>
      durationOk(p, duration) &&
      rowDim(p, 'mode') == null &&
      dimMatches(p, 'resolution', resolution) &&
      dimMatches(p, 'duration', duration),
    (p) =>
      durationOk(p, duration) &&
      rowDim(p, 'mode') == null &&
      rowDim(p, 'resolution') == null &&
      dimMatches(p, 'duration', duration),
    (p) =>
      durationOk(p, duration) &&
      eq(rowDim(p, 'mode') ?? undefined, mode) &&
      eq(rowDim(p, 'resolution') ?? undefined, resolution),
    (p) =>
      durationOk(p, duration) &&
      rowDim(p, 'mode') == null &&
      eq(rowDim(p, 'resolution') ?? undefined, resolution),
    (p) =>
      durationOk(p, duration) &&
      rowDim(p, 'resolution') == null &&
      eq(rowDim(p, 'mode') ?? undefined, mode),
    (p) => durationOk(p, duration) && eq(rowDim(p, 'resolution') ?? undefined, resolution),
    (p) => durationOk(p, duration) && eq(rowDim(p, 'mode') ?? undefined, mode),
  ];

  for (const pred of predicates) {
    const hit = prices.find(pred);
    if (hit) return hit;
  }
  return null;
}

/** Giá thực tế theo mode + resolution + duration. Xử lý mọi dạng prices[] upstream. */
export function resolveModelPrice(
  model: GommoModel | null,
  mode: string,
  resolution: string,
  duration = '',
): number {
  if (!model) return 0;
  const prices = model.prices;
  if (!Array.isArray(prices) || prices.length === 0) return model.price ?? 0;
  const hit = findPriceRow(prices as PriceRow[], mode, resolution, duration);
  return hit?.price ?? model.price ?? prices[0]?.price ?? 0;
}

/** Nhãn khoảng giá min–max từ prices[] (picker / badge). */
export function modelPriceRangeLabel(model: GommoModel | null | undefined): string {
  if (!model) return '';
  const values: number[] = [];
  if (Array.isArray(model.prices)) {
    for (const p of model.prices) {
      if (typeof p?.price === 'number' && p.price > 0) values.push(p.price);
    }
  }
  if (values.length === 0 && typeof model.price === 'number' && model.price > 0) {
    values.push(model.price);
  }
  if (values.length === 0) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? formatPrice(min) : `${formatPrice(min)}-${formatPrice(max)}`;
}

/** Nhãn variant bảng giá: mode · resolution · duration. */
export function formatPriceVariant(row: {
  mode?: string;
  resolution?: string;
  duration?: string | number;
}): string {
  const parts: string[] = [];
  if (row.mode) parts.push(String(row.mode));
  if (row.resolution) parts.push(String(row.resolution));
  if (row.duration != null && row.duration !== '') {
    const d = String(row.duration);
    parts.push(/s$/i.test(d) ? d : `${d}s`);
  }
  return parts.join(' · ') || 'Mặc định';
}
