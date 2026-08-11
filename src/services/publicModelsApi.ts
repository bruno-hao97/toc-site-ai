import type { GommoModel, JobType } from './api';
import { isModelAvailable, modelSlug, parseModelsList } from './modelSchema';
import { formatPriceVariant, modelPriceRangeLabel } from './modelPricing';
import { PLATFORM_BRIDGE } from './platformBridge';

export const MODEL_CATALOG_TYPES = [
  'video',
  'image',
  'tts',
  'avatar-lipsync',
  'music',
] as const satisfies readonly JobType[];

export type ModelCatalogType = (typeof MODEL_CATALOG_TYPES)[number];

export interface CatalogModel extends GommoModel {
  catalogType: ModelCatalogType;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { at: number; models: CatalogModel[] } | null = null;

export const CATALOG_TYPE_LABELS: Record<ModelCatalogType, string> = {
  video: 'Video',
  image: 'Hình ảnh',
  tts: 'Audio / TTS',
  music: 'Nhạc',
  'avatar-lipsync': 'Avatar Lipsync',
};

export const SERVER_LABELS: Record<string, string> = {
  hailuoai: 'HAILUO',
  klingai: 'KLING',
  bytedanceai: 'BYTEDANCE',
  google_veo: 'GOOGLE VEO',
  fluxai: 'FLUX',
  wanai: 'WAN',
  grokai: 'GROK',
  autoai: 'AUTO',
  minimax: 'MINIMAX',
  luma: 'LUMA',
  runway: 'RUNWAY',
  pika: 'PIKA',
  midjourney: 'MIDJOURNEY',
  ideogram: 'IDEOGRAM',
  leonardo: 'LEONARDO',
};

const STUDIO_ROUTE: Record<ModelCatalogType, string> = {
  video: '/video',
  image: '/image',
  music: '/music',
  tts: '/audio',
  'avatar-lipsync': '/video',
};

export async function fetchPublicModels(type: ModelCatalogType): Promise<CatalogModel[]> {
  const res = await fetch(
    `${PLATFORM_BRIDGE.publicModels}?type=${encodeURIComponent(type)}`,
    { headers: { Accept: 'application/json' } },
  );
  const raw = (await res.json()) as {
    success?: boolean;
    message?: string;
    data?: unknown;
  };
  if (!res.ok || raw.success === false) {
    throw new Error(raw.message || 'Không tải được danh sách model');
  }
  return parseModelsList(raw.data)
    .filter(isModelAvailable)
    .map((m) => ({ ...m, catalogType: type }));
}

export async function fetchAllPublicModels(force = false): Promise<CatalogModel[]> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.models;
  }
  const pages = await Promise.all(MODEL_CATALOG_TYPES.map((type) => fetchPublicModels(type)));
  const models = pages.flat();
  cache = { at: Date.now(), models };
  return models;
}

export function providerLabel(server?: string): string {
  if (!server) return 'AI';
  const key = server.toLowerCase();
  return SERVER_LABELS[key] || server.replace(/ai$/i, '').toUpperCase() || server.toUpperCase();
}

export function modelFeatureTags(m: GommoModel, catalogType: ModelCatalogType): string[] {
  const tags: string[] = [];
  const ext = m as GommoModel & {
    startText?: boolean;
    startImage?: boolean;
    startImageAndEnd?: boolean;
    withReference?: boolean;
    withMotion?: boolean;
    withEdit?: boolean;
    withLipsync?: boolean;
    withUpscale?: boolean;
    withMultiShots?: boolean;
    extendVideo?: boolean;
  };

  if (ext.startText) tags.push(catalogType === 'image' ? 'Text2Image' : 'Text2Video');
  if (ext.startImage) tags.push(catalogType === 'image' ? 'Img2Image' : 'Img2Video');
  if (ext.withReference) tags.push('Reference');
  if (ext.withMotion) tags.push('Motion');
  if (ext.withEdit) tags.push('Edit');
  if (ext.withLipsync) tags.push('Lipsync');
  if (ext.withUpscale) tags.push('Upscale');
  if (ext.startImageAndEnd) tags.push('Start+End');
  if (ext.withMultiShots) tags.push('Multi-shot');
  if (ext.extendVideo) tags.push('Extend');

  const resolutions = m.resolutions;
  if (Array.isArray(resolutions) && resolutions.length === 1) {
    const name = (resolutions[0] as { name?: string })?.name;
    if (name) tags.push(name.toUpperCase());
  }

  return tags.slice(0, 6);
}

export function modelStatLine(m: GommoModel): string {
  const parts: string[] = [];
  if (Array.isArray(m.ratios) && m.ratios.length) {
    parts.push(`${m.ratios.length} Ratios`);
  }
  if (Array.isArray(m.resolutions) && m.resolutions.length) {
    parts.push(`${m.resolutions.length} Resolutions`);
  }
  if (Array.isArray(m.durations) && m.durations.length) {
    parts.push(`${m.durations.length} Durations`);
  }
  return parts.join(' · ');
}

export function modelPriceLabel(m: GommoModel): string {
  const range = modelPriceRangeLabel(m);
  if (!range) return '';
  const unit = m.rate_type === 'per_second' ? '/ giây' : '/ lượt';
  return `${range} ${unit}`;
}

/** Nhãn giá trên catalog card — giống 79AI: "11400-34200 credits". */
export function modelCreditsLabel(m: GommoModel): string {
  const range = modelPriceRangeLabel(m);
  if (!range) return '';
  return `${range} credits`;
}

export function modelBaseCredits(m: GommoModel): number | null {
  if (typeof m.price === 'number' && m.price > 0) return m.price;
  const prices = m.prices;
  if (!Array.isArray(prices) || !prices.length) return null;
  const values = prices
    .map((p) => p.price)
    .filter((n): n is number => typeof n === 'number' && n > 0);
  return values.length ? Math.min(...values) : null;
}

export interface ModelPriceTableRow {
  label: string;
  credits: number;
}

export function modelPriceTableRows(m: GommoModel): ModelPriceTableRow[] {
  const prices = Array.isArray(m.prices) ? m.prices : [];
  if (!prices.length) {
    const base = modelBaseCredits(m);
    if (!base) return [];
    return [
      {
        label: m.rate_type === 'per_second' ? 'MỖI GIÂY' : 'MẶC ĐỊNH',
        credits: base,
      },
    ];
  }
  return prices
    .filter((p) => typeof p.price === 'number' && (p.price ?? 0) > 0)
    .map((p) => ({
      label: formatPriceVariant(p).toUpperCase(),
      credits: p.price as number,
    }));
}

export function isModelNew(m: GommoModel): boolean {
  if (Number(m.sale || 0) > 0) return true;
  const created = m.created_time;
  if (typeof created !== 'number' || created <= 0) return false;
  const ageMs = Date.now() - created * 1000;
  return ageMs < 45 * 24 * 60 * 60 * 1000;
}

export function studioRouteForModel(m: CatalogModel): string {
  return STUDIO_ROUTE[m.catalogType];
}

export function studioStateForModel(m: CatalogModel) {
  return {
    reuseHistory: {
      type: m.catalogType,
      modelSlug: modelSlug(m),
    },
  };
}

export function uniqueProviders(models: CatalogModel[]): string[] {
  const set = new Set<string>();
  for (const m of models) {
    if (m.server) set.add(m.server.toLowerCase());
  }
  return [...set].sort();
}
