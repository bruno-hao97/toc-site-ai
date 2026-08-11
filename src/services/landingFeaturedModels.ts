import type { GommoModel } from './api';
import { LANDING_FEATURED_MODELS, type LandingFeaturedModel } from '../config/landingFeaturedModels';
import type { CatalogModel } from './publicModelsApi';
import {
  CATALOG_TYPE_LABELS,
  fetchAllPublicModels,
  providerLabel,
} from './publicModelsApi';
import { isModelAvailable, modelSlug } from './modelSchema';

const LANDING_FEATURED_COUNT = 4;
const LANDING_HERO_MODEL_COUNT = 3;

function fallbackHeroModelNames(): string[] {
  return LANDING_FEATURED_MODELS.slice(0, LANDING_HERO_MODEL_COUNT).map((m) => m.name);
}

function truncateDescription(text: string, max = 108): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trimEnd()}…`;
}

function catalogTag(type: CatalogModel['catalogType']): string {
  if (type === 'image') return 'Ảnh';
  if (type === 'video') return 'Video';
  return CATALOG_TYPE_LABELS[type];
}

function createdTs(m: GommoModel): number {
  return typeof m.created_time === 'number' && m.created_time > 0 ? m.created_time : 0;
}

function sortNewestFirst(a: CatalogModel, b: CatalogModel): number {
  const byTime = createdTs(b) - createdTs(a);
  if (byTime !== 0) return byTime;
  return (a.name || modelSlug(a)).localeCompare(b.name || modelSlug(b));
}

function fromCatalog(m: CatalogModel): LandingFeaturedModel {
  const desc =
    m.description?.trim() ||
    `Model ${providerLabel(m.server)} trên AGI Center — xem giá credits trên catalog.`;
  return {
    id: modelSlug(m),
    name: m.name || modelSlug(m),
    tag: catalogTag(m.catalogType),
    description: truncateDescription(desc),
  };
}

function padToCount(items: LandingFeaturedModel[]): LandingFeaturedModel[] {
  if (items.length >= LANDING_FEATURED_COUNT) {
    return items.slice(0, LANDING_FEATURED_COUNT);
  }
  const seen = new Set(items.map((m) => m.id));
  const padded = [...items];
  for (const fallback of LANDING_FEATURED_MODELS) {
    if (padded.length >= LANDING_FEATURED_COUNT) break;
    if (seen.has(fallback.id)) continue;
    seen.add(fallback.id);
    padded.push(fallback);
  }
  return padded;
}

export async function resolveLandingFeaturedModels(): Promise<LandingFeaturedModel[]> {
  try {
    const catalog = await fetchAllPublicModels();
    const newest = catalog
      .filter(isModelAvailable)
      .sort(sortNewestFirst)
      .map(fromCatalog);

    if (newest.length > 0) {
      return padToCount(newest);
    }
  } catch {
    /* fallback below */
  }

  return LANDING_FEATURED_MODELS;
}

export async function resolveLandingNewestModelNames(
  count = LANDING_HERO_MODEL_COUNT,
): Promise<string[]> {
  try {
    const catalog = await fetchAllPublicModels();
    const newest = catalog
      .filter(isModelAvailable)
      .sort(sortNewestFirst)
      .slice(0, count)
      .map((m) => m.name || modelSlug(m));

    if (newest.length > 0) {
      if (newest.length >= count) return newest;
      const seen = new Set(newest.map((n) => n.toLowerCase()));
      for (const fallback of LANDING_FEATURED_MODELS) {
        if (newest.length >= count) break;
        if (seen.has(fallback.name.toLowerCase())) continue;
        seen.add(fallback.name.toLowerCase());
        newest.push(fallback.name);
      }
      return newest;
    }
  } catch {
    /* fallback below */
  }

  return fallbackHeroModelNames();
}
