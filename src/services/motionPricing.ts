import type { GommoModel } from './api';

function formatPrice(price: number): string {
  return price.toLocaleString('vi-VN');
}

function eq(a?: string, b?: string): boolean {
  return (a ?? '').toLowerCase() === (b ?? '').toLowerCase();
}

function readPositiveNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function readPercent(value: unknown): number {
  if (typeof value === 'number' && value > 0 && value <= 100) return Math.round(value);
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    for (const key of ['percent', 'percentage', 'value', 'rate']) {
      const n = o[key];
      if (typeof n === 'number' && n > 0 && n <= 100) return Math.round(n);
    }
  }
  return 0;
}

type PriceRow = {
  mode?: string;
  resolution?: string;
  price?: number;
  price_default?: number;
} & Record<string, unknown>;

/** Khớp hàng `prices[]` — Motion dùng `mode` (standard/professional), không resolution. */
function findMotionPriceRow(
  model: GommoModel | null,
  mode: string,
  resolution: string,
): PriceRow | null {
  if (!model) return null;
  const prices = model.prices;
  if (!Array.isArray(prices) || prices.length === 0) return null;

  const hasMode = Boolean(mode?.trim());
  const hasRes = Boolean(resolution?.trim());

  if (hasMode && hasRes) {
    const both = prices.find((p) => eq(p.mode, mode) && eq(p.resolution, resolution));
    if (both) return both as PriceRow;
  }
  if (hasMode) {
    const byMode = prices.find((p) => eq(p.mode, mode));
    if (byMode) return byMode as PriceRow;
  }
  if (hasRes) {
    const byRes = prices.find((p) => eq(p.resolution, resolution));
    if (byRes) return byRes as PriceRow;
  }
  return (prices[0] as PriceRow) ?? null;
}

function readDefaultRateFromRow(row: PriceRow, saleRate: number, promoPercent: number): number {
  const listRate = readPositiveNumber(row.price_default);
  if (listRate > 0) return listRate;

  for (const key of [
    'original_price',
    'price_original',
    'original',
    'list_price',
    'price_before',
    'root_price',
    'full_price',
    'price_root',
    'price_old',
  ]) {
    const n = readPositiveNumber(row[key]);
    if (n > 0) return n;
  }
  if (saleRate > 0 && promoPercent > 0 && promoPercent < 100) {
    return Math.round(saleRate / (1 - promoPercent / 100));
  }
  return saleRate;
}

export interface MotionPriceQuote {
  billedSeconds: number;
  saleRatePerSec: number;
  originalRatePerSec: number;
  scriptCount: number;
  promoPercent: number;
  grossTotal: number;
  finalTotal: number;
}

export function isMotionPricingModel(model: GommoModel | null | undefined): boolean {
  return Boolean(model && (model as { withMotion?: boolean }).withMotion);
}

/** Rate sale hiển thị (/s) — `prices[].price` (đã sau giảm, không nhân thêm sale%). */
export function resolveMotionRatePerSecond(
  model: GommoModel | null,
  mode: string,
  resolution: string,
): number {
  const row = findMotionPriceRow(model, mode, resolution);
  if (row) {
    const sale = readPositiveNumber(row.price ?? row.sale_price ?? row.price_sale);
    if (sale > 0) return sale;
  }
  if (!model) return 0;
  if (!Array.isArray(model.prices) || model.prices.length === 0) return model.price ?? 0;
  return model.price ?? readPositiveNumber((model.prices[0] as PriceRow).price) ?? 0;
}

/** Rate niêm yết (/s) — `prices[].price_default`. */
export function resolveMotionOriginalRatePerSecond(
  model: GommoModel | null,
  mode: string,
  resolution: string,
  promoPercent = 0,
): number {
  const row = findMotionPriceRow(model, mode, resolution);
  const saleRate = resolveMotionRatePerSecond(model, mode, resolution);
  const promo = promoPercent || getMotionPromotionPercent(model);
  if (row) {
    return readDefaultRateFromRow(row, saleRate, promo);
  }
  if (saleRate > 0 && promo > 0 && promo < 100) {
    return Math.round(saleRate / (1 - promo / 100));
  }
  return saleRate;
}

export function motionModelPriceLabel(m: GommoModel): string {
  const values: number[] = [];
  if (Array.isArray(m.prices)) {
    for (const p of m.prices) {
      if (typeof p?.price === 'number' && p.price > 0) values.push(p.price);
    }
  }
  if (values.length === 0 && typeof m.price === 'number' && m.price > 0) {
    values.push(m.price);
  }
  if (values.length === 0) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = min === max ? formatPrice(min) : `${formatPrice(min)}-${formatPrice(max)}`;
  return `${range}/s`;
}

export function motionRateLabel(
  model: GommoModel | null,
  mode: string,
  resolution: string,
): string {
  const rate = resolveMotionRatePerSecond(model, mode, resolution);
  if (!rate) return '';
  return `${formatPrice(rate)}/s`;
}

/** % khuyến mãi từ `model.sale` (vd. 20). */
export function getMotionPromotionPercent(model: GommoModel | null): number {
  if (!model) return 0;

  const modelSale = readPercent(model.sale);
  if (modelSale > 0) return modelSale;

  const raw = model as unknown as Record<string, unknown>;
  for (const key of [
    'promotion',
    'promotion_percent',
    'sale_percent',
    'discount_percent',
    'discount',
    'promo',
  ]) {
    const pct = readPercent(raw[key]);
    if (pct > 0) return pct;
  }
  const cfg = model.configs as Record<string, unknown> | undefined;
  const motion = cfg?.motion as Record<string, unknown> | undefined;
  if (motion) {
    for (const key of ['promotion', 'promotion_percent', 'sale', 'discount']) {
      const pct = readPercent(motion[key]);
      if (pct > 0) return pct;
    }
  }
  return 0;
}

/** Giây tính tiền — 79 Motion làm tròn lên số nguyên (vd. 5.2s → 6s). */
export function getMotionBillingSeconds(
  rawDurationSec: number,
  model?: GommoModel | null,
): number {
  return getMotionBilledSeconds(rawDurationSec, model);
}

/** Số giây hiển thị trong breakdown (số nguyên làm tròn lên). */
export function getMotionBilledSeconds(
  rawDurationSec: number,
  model?: GommoModel | null,
): number {
  if (!Number.isFinite(rawDurationSec) || rawDurationSec <= 0) return 0;
  const eps = 0.04;
  let sec = Math.ceil(Math.max(0, rawDurationSec - eps));

  const cfg = model?.configs as Record<string, unknown> | undefined;
  const motion = cfg?.motion as Record<string, unknown> | undefined;
  const billing = motion?.billing as Record<string, unknown> | undefined;
  const minBill = Number(
    billing?.min_seconds ?? motion?.min_bill_seconds ?? motion?.min_duration ?? 0,
  );
  if (Number.isFinite(minBill) && minBill > 0) {
    sec = Math.max(sec, Math.ceil(minBill));
  }
  return Math.max(1, sec);
}

/**
 * Báo giá Motion (khớp 79 create-video):
 * gross = price_default × giây × kịch bản
 * final = price × giây × kịch bản  (= credit_fee, không nhân thêm sale%)
 */
export function computeMotionPriceQuote(
  model: GommoModel | null,
  mode: string,
  resolution: string,
  rawDurationSec: number,
  scriptCount = 1,
): MotionPriceQuote {
  const promoPercent = getMotionPromotionPercent(model);
  const saleRatePerSec = resolveMotionRatePerSecond(model, mode, resolution);
  const originalRatePerSec = resolveMotionOriginalRatePerSecond(
    model,
    mode,
    resolution,
    promoPercent,
  );
  const billedSeconds = getMotionBilledSeconds(rawDurationSec, model);
  const scripts = Math.max(1, scriptCount);

  const grossTotal =
    originalRatePerSec > 0 && billedSeconds > 0
      ? Math.round(originalRatePerSec * billedSeconds * scripts)
      : 0;
  const finalTotal =
    saleRatePerSec > 0 && billedSeconds > 0
      ? Math.round(saleRatePerSec * billedSeconds * scripts)
      : grossTotal > 0 && promoPercent > 0 && promoPercent < 100
        ? Math.round(grossTotal * (1 - promoPercent / 100))
        : grossTotal;

  return {
    billedSeconds,
    saleRatePerSec,
    originalRatePerSec,
    scriptCount: scripts,
    promoPercent: Math.max(0, Math.min(100, promoPercent)),
    grossTotal,
    finalTotal,
  };
}

/** @deprecated Dùng computeMotionPriceQuote */
export function computeMotionTotalCost(
  ratePerSecond: number,
  rawDurationSec: number,
  scriptCount = 1,
  promotionPercent = 0,
  model?: GommoModel | null,
  mode = '',
  resolution = '',
): number {
  if (model) {
    return computeMotionPriceQuote(model, mode, resolution, rawDurationSec, scriptCount)
      .finalTotal;
  }
  const billedSec = getMotionBilledSeconds(rawDurationSec);
  if (!ratePerSecond || billedSec <= 0) return 0;
  const scripts = Math.max(1, scriptCount);
  const promo = Math.max(0, Math.min(100, promotionPercent));
  const originalRate =
    promo > 0 && promo < 100 ? Math.round(ratePerSecond / (1 - promo / 100)) : ratePerSecond;
  const gross = Math.round(originalRate * billedSec * scripts);
  return promo > 0 && promo < 100 ? Math.round(gross * (1 - promo / 100)) : gross;
}

function readVideoDuration(video: HTMLVideoElement): number {
  const d = video.duration;
  return Number.isFinite(d) && d > 0 ? d : 0;
}

function probeVideoElementDuration(url: string, useCors: boolean): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    if (useCors) video.crossOrigin = 'anonymous';

    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
    };

    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('Hết thời gian đọc video.'));
    }, 25_000);

    const finish = (dur: number) => {
      window.clearTimeout(timer);
      cleanup();
      if (dur > 0) resolve(dur);
      else reject(new Error('Không đọc được thời lượng video.'));
    };

    video.onloadedmetadata = () => finish(readVideoDuration(video));
    video.onloadeddata = () => {
      const dur = readVideoDuration(video);
      if (dur > 0) finish(dur);
    };
    video.onerror = () => {
      window.clearTimeout(timer);
      cleanup();
      reject(new Error('Không đọc được thời lượng video.'));
    };
    video.src = url;
  });
}

export async function probeVideoDurationFromUrl(url: string): Promise<number> {
  try {
    return await probeVideoElementDuration(url, false);
  } catch {
    return probeVideoElementDuration(url, true);
  }
}
