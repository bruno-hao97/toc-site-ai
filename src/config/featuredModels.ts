import { studioRouteForType } from '../constants/studioTypes';
import { magnificSrc } from '../lib/landingMedia';
import { UPSCALE_MODEL_ID } from '../services/imageUpscale';
import type { JobType } from '../services/api';
import type { FeaturedModelMatch } from '../utils/featuredModelPick';

export type FeaturedMediaKind = 'image' | 'video';

export interface FeaturedStudioConfig {
  type: JobType;
  /** Fallback khi không tìm được model mới nhất. */
  modelSlug?: string;
  /** Chọn model mới nhất khớp `match` (hoặc toàn catalog nếu không có match). */
  pickLatest?: boolean;
  match?: FeaturedModelMatch;
}

export interface FeaturedModelItem {
  id: string;
  label: string;
  to: string;
  mediaKind: FeaturedMediaKind;
  src: string;
  studio?: FeaturedStudioConfig;
}

function featuredStudio(
  id: string,
  label: string,
  mediaKind: FeaturedMediaKind,
  src: string,
  studio: FeaturedStudioConfig,
): FeaturedModelItem {
  return {
    id,
    label,
    to: studioRouteForType(studio.type),
    mediaKind,
    src,
    studio,
  };
}

/** Carousel Nổi bật trên Home — Leonardo-style, scroll ngang. */
export const FEATURED_MODELS: FeaturedModelItem[] = [
  featuredStudio(
    'seedance-25',
    'Seedance 2.5',
    'video',
    'https://cdn.leonardo.ai/static/images/models/bytedance/seedance-2.5.webm',
    {
      type: 'video',
      pickLatest: true,
      match: { server: 'bytedanceai', slugIncludes: ['seedance'] },
      modelSlug: 'seedance-2-omni',
    },
  ),
  featuredStudio(
    'kling-video',
    'Kling',
    'video',
    'https://cdn.leonardo.ai/static/images/video/models/hailuo-03.webm',
    {
      type: 'video',
      pickLatest: true,
      match: { server: 'klingai' },
      modelSlug: 'kling-v2',
    },
  ),
  featuredStudio(
    'create-image',
    'Create Image',
    'image',
    'https://cdn.leonardo.ai/static/images/create_an_image.webp',
    {
      type: 'image',
      pickLatest: true,
      match: { slugIncludes: ['imagegen'] },
      modelSlug: 'imagegen_2_0',
    },
  ),
  featuredStudio(
    'logo-creator',
    'Logo Creator',
    'image',
    'https://cdn.leonardo.ai/blueprint_assets/official/384ab5c8-55d8-47a1-be22-6a274913c324/thumbnails/thumbnail-f5edb8.webp',
    {
      type: 'image',
      pickLatest: true,
      match: { slugIncludes: ['google_image_gen_banana', 'banana_pro'] },
      modelSlug: 'google_image_gen_banana_pro',
    },
  ),
  featuredStudio(
    'branding',
    'Branding',
    'image',
    'https://cdn.leonardo.ai/static/images/consistent_branding.webp',
    {
      type: 'image',
      pickLatest: true,
      match: { slugIncludes: ['google_image_gen_banana', 'banana_pro'] },
      modelSlug: 'google_image_gen_banana_pro',
    },
  ),
  {
    id: 'how-to-use-agi',
    label: 'How to use AGI',
    to: '/chat',
    mediaKind: 'image',
    src: 'https://assets.leonardo.ai/acUcV5GXnQHGY_Sn_nano-banana-prompt-guide-example.jpg?auto=compress%2Cformat&fit=max&q=80&w=960',
  },
  featuredStudio(
    'background-change',
    'Background Change',
    'image',
    'https://cdn.leonardo.ai/blueprint_assets/official/384ab5c8-55d8-47a1-be22-6a274913c324/thumbnails/thumbnail-ec50ac.webp',
    {
      type: 'image',
      pickLatest: true,
      match: { slugIncludes: ['google_image_gen_banana', 'banana_pro'] },
      modelSlug: 'google_image_gen_banana_pro',
    },
  ),
  {
    id: 'spaces',
    label: 'Spaces',
    to: '/workflow',
    mediaKind: 'image',
    src: magnificSrc('spaces', 720, 960, 78),
  },
  featuredStudio(
    'text-to-speech',
    'Audio',
    'image',
    magnificSrc('text-to-speech', 720, 960, 78),
    {
      type: 'tts',
      pickLatest: true,
      match: { slugIncludes: ['eleven'] },
      modelSlug: 'eleven_v3',
    },
  ),
  featuredStudio(
    'upscale',
    'Upscale',
    'image',
    magnificSrc('video-upscaler', 720, 960, 78),
    {
      type: 'image-upscale',
      pickLatest: true,
      match: { slugIncludes: ['upscale'] },
      modelSlug: UPSCALE_MODEL_ID,
    },
  ),
  featuredStudio(
    'background-remover',
    'Remove Background',
    'image',
    magnificSrc('background-remover', 720, 960, 78),
    {
      type: 'remove-bg',
      pickLatest: true,
      modelSlug: 'remove_bg',
    },
  ),
];
