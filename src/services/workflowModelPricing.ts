import type { GommoModel } from './api';
import { readProgressLocale } from './pollProgressCopy';

/** Giá credit theo mode + resolution (khớp StudioPage). */
export function resolveWorkflowModelPrice(
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

export function formatCreditBadge(credits: number): string {
  if (credits <= 0) return '';
  return `${Math.round(credits)}c`;
}

export function formatGenTimer(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Map trạng thái tạo → copy hiển thị trên node workflow. */
export function formatGenLoadingCopy(statusText?: string): { primary: string; secondary: string } {
  const raw = (statusText || '').trim();
  const locale = readProgressLocale();
  const processing = locale === 'en' ? 'Processing…' : 'Đang xử lý…';
  if (!raw || /poll #\d+|pending_active|media_generation|^(running|unknown)$/i.test(raw)) {
    return { primary: 'CREATING...', secondary: processing };
  }
  if (/đang|creating|processing|queued|waiting|render|generat/i.test(raw)) {
    return { primary: 'CREATING...', secondary: raw };
  }
  return { primary: 'CREATING...', secondary: raw };
}

