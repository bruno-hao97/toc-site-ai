import type { GommoModel } from './api';

/** Giá thực tế theo tổ hợp mode + resolution đang chọn. Xử lý mọi dạng prices[]:
 * có cả mode+resolution, chỉ resolution (Kling), hoặc chỉ mode (Midjourney 7.0). */
export function resolveModelPrice(
  model: GommoModel | null,
  mode: string,
  resolution: string,
): number {
  if (!model) return 0;
  const prices = model.prices;
  if (!Array.isArray(prices) || prices.length === 0) return model.price ?? 0;
  const eq = (a?: string, b?: string) => (a ?? '').toLowerCase() === (b ?? '').toLowerCase();

  const hit =
    prices.find((p) => eq(p.mode, mode) && eq(p.resolution, resolution)) ??
    prices.find((p) => p.mode == null && eq(p.resolution, resolution)) ??
    prices.find((p) => p.resolution == null && eq(p.mode, mode)) ??
    prices.find((p) => eq(p.resolution, resolution)) ??
    prices.find((p) => eq(p.mode, mode));
  return hit?.price ?? model.price ?? prices[0]?.price ?? 0;
}
