import type { GommoModel } from '../services/api';
import { isModelAvailable, modelSlug } from '../services/modelSchema';

export interface FeaturedModelMatch {
  /** Khớp `m.server` (không phân biệt hoa thường), vd. `klingai`, `bytedanceai`. */
  server?: string;
  /** Slug chứa ít nhất một chuỗi (không phân biệt hoa thường). */
  slugIncludes?: string[];
  /** Tên model chứa ít nhất một chuỗi (không phân biệt hoa thường). */
  nameIncludes?: string[];
}

function modelCreatedTs(m: GommoModel): number {
  return typeof m.created_time === 'number' && m.created_time > 0 ? m.created_time : 0;
}

function includesAny(haystack: string, needles: string[]): boolean {
  const h = haystack.toLowerCase();
  return needles.some((n) => h.includes(n.toLowerCase()));
}

function isModelOn(m: GommoModel): boolean {
  const s = String(m.status || 'ON').toUpperCase();
  return s === 'ON' || s === 'ACTIVE';
}

/** Bỏ biến thể chuyên dụng (LipSync, preset 5s/10s, motion, edit) khi chọn flagship mới nhất. */
export function isSpecializedStudioVariant(m: GommoModel): boolean {
  const name = (m.name || modelSlug(m)).toLowerCase();
  const slug = modelSlug(m).toLowerCase();
  const ext = m as GommoModel & { withMotion?: boolean; withEdit?: boolean };

  if (ext.withMotion || ext.withEdit) return true;
  if (/lipsync|lip-sync|lip sync/.test(name) || /lipsync/.test(slug)) return true;
  if (/\b\d+\s*s\b/.test(name) && /\bfull\s*hd\b|\bhd\b/.test(name)) return true;
  if (/\b\d+\s*sec\b/.test(name)) return true;

  return false;
}

/** Trích version chính từ tên/slug (vd. Kling 3.0 → 3, seedance-2-omni → 2). */
export function extractPrimaryVersionScore(m: GommoModel): number {
  const name = m.name || '';
  const slug = modelSlug(m);
  const n = name.toLowerCase();
  const s = slug.toLowerCase();

  const brandPatterns: RegExp[] = [
    /kling\s*[-–]?\s*(\d+(?:\.\d+)?)/i,
    /kling[-_]?v?(\d+(?:\.\d+)?)/i,
    /seedance\s*[-–]?\s*(\d+(?:\.\d+)?)/i,
    /seedance[-_]?(\d+(?:\.\d+)?)/i,
    /seedream\s*[-–]?\s*(\d+(?:\.\d+)?)/i,
    /imagegen[-_]?(\d+(?:[._]\d+)?)/i,
    /eleven[-_]?v?(\d+(?:\.\d+)?)/i,
    /banana[-_]?pro?[-_]?v?(\d+(?:\.\d+)?)/i,
    /upscale[-_]?v?(\d+(?:\.\d+)?)/i,
    /v(\d+(?:\.\d+)?)(?:[-_]|$)/i,
  ];

  for (const pattern of [...brandPatterns.map((p) => ({ text: n, re: p })), ...brandPatterns.map((p) => ({ text: s, re: p }))]) {
    const hit = pattern.text.match(pattern.re);
    if (hit?.[1]) {
      const raw = hit[1].replace(/_/g, '.');
      const v = parseFloat(raw);
      if (!Number.isNaN(v) && v > 0 && v <= 50) return v;
    }
  }

  const nums = n.match(/\b(\d+(?:\.\d+)?)\b/g);
  if (nums) {
    const plausible = nums.map(parseFloat).filter((v) => v > 0 && v <= 50);
    if (plausible.length) return Math.max(...plausible);
  }

  return 0;
}

function compareFeaturedModelsNewest(a: GommoModel, b: GommoModel): number {
  const byVersion = extractPrimaryVersionScore(b) - extractPrimaryVersionScore(a);
  if (byVersion !== 0) return byVersion;

  const byTime = modelCreatedTs(b) - modelCreatedTs(a);
  if (byTime !== 0) return byTime;

  return modelSlug(b).localeCompare(modelSlug(a));
}

export function matchesFeaturedModel(m: GommoModel, match: FeaturedModelMatch): boolean {
  if (match.server && (m.server || '').toLowerCase() !== match.server.toLowerCase()) {
    return false;
  }
  if (match.slugIncludes?.length && !includesAny(modelSlug(m), match.slugIncludes)) {
    return false;
  }
  if (match.nameIncludes?.length && !includesAny(m.name || '', match.nameIncludes)) {
    return false;
  }
  return Boolean(match.server || match.slugIncludes?.length || match.nameIncludes?.length);
}

function sortFeaturedCandidates(candidates: GommoModel[]): GommoModel[] {
  return [...candidates].sort(compareFeaturedModelsNewest);
}

/** Chọn model flagship mới nhất (version tên → created_time) khớp bộ lọc Featured. */
export function pickNewestFeaturedModel(
  models: GommoModel[],
  match: FeaturedModelMatch,
  fallbackSlug?: string,
): string | undefined {
  const matched = models
    .filter(isModelAvailable)
    .filter(isModelOn)
    .filter((m) => matchesFeaturedModel(m, match));

  const flagship = matched.filter((m) => !isSpecializedStudioVariant(m));
  const candidates = sortFeaturedCandidates(flagship.length ? flagship : matched);

  if (candidates[0]) return modelSlug(candidates[0]);

  if (fallbackSlug && models.some((m) => modelSlug(m) === fallbackSlug)) {
    return fallbackSlug;
  }

  return undefined;
}

/** Không có bộ lọc — lấy model flagship mới nhất trong toàn bộ catalog job type. */
export function pickNewestModel(models: GommoModel[], fallbackSlug?: string): string | undefined {
  const matched = models.filter(isModelAvailable).filter(isModelOn);
  const flagship = matched.filter((m) => !isSpecializedStudioVariant(m));
  const candidates = sortFeaturedCandidates(flagship.length ? flagship : matched);

  if (candidates[0]) return modelSlug(candidates[0]);
  if (fallbackSlug && models.some((m) => modelSlug(m) === fallbackSlug)) return fallbackSlug;
  return undefined;
}

export function resolveFeaturedModelSlug(
  models: GommoModel[],
  opts: {
    pickLatest?: boolean;
    match?: FeaturedModelMatch;
    modelSlug?: string;
  },
): string | undefined {
  if (opts.pickLatest) {
    const hasMatch =
      opts.match &&
      (opts.match.server || opts.match.slugIncludes?.length || opts.match.nameIncludes?.length);
    if (hasMatch && opts.match) {
      return pickNewestFeaturedModel(models, opts.match, opts.modelSlug);
    }
    return pickNewestModel(models, opts.modelSlug);
  }
  if (opts.modelSlug && models.some((m) => modelSlug(m) === opts.modelSlug)) {
    return opts.modelSlug;
  }
  return opts.modelSlug;
}
