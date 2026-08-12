import { studioRouteForType } from '../constants/studioTypes';
import type { JobType } from '../services/api';
import type { FeaturedModelMatch } from './featuredModelPick';

export type { FeaturedModelMatch };

export interface FeaturedReuseHistory {
  type: JobType;
  modelSlug?: string;
  pickLatest?: boolean;
  match?: FeaturedModelMatch;
  prompt?: string;
  meta?: Record<string, string>;
}

/** Job studio reuse có thể mở trên cùng route (vd. image-upscale → /image). */
export function featuredReuseMatchesPage(pageType: JobType, reuseType: JobType): boolean {
  return studioRouteForType(reuseType) === studioRouteForType(pageType);
}

export function featuredLinkState(studio?: {
  type: JobType;
  modelSlug?: string;
  pickLatest?: boolean;
  match?: FeaturedModelMatch;
}): { reuseHistory: FeaturedReuseHistory } | undefined {
  if (!studio) return undefined;
  return {
    reuseHistory: {
      type: studio.type,
      modelSlug: studio.modelSlug,
      pickLatest: studio.pickLatest,
      match: studio.match,
    },
  };
}
