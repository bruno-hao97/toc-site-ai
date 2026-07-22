import type { GommoModel } from './api';
import { resolveModelPrice } from './modelPricing';
import { readProgressLocale } from './pollProgressCopy';

/** Giá credit theo mode + resolution + duration (khớp StudioPage). */
export function resolveWorkflowModelPrice(
  model: GommoModel | null,
  mode: string,
  resolution: string,
  duration = '',
): number {
  return resolveModelPrice(model, mode, resolution, duration);
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
