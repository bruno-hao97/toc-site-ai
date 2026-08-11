import { magnificSrc } from '../lib/landingMedia';
import type { JobType } from '../services/api';

export type FeaturedMediaKind = 'image' | 'video';

export interface FeaturedModelItem {
  id: string;
  label: string;
  to: string;
  mediaKind: FeaturedMediaKind;
  src: string;
  /** Pre-select model trong studio khi điều hướng. */
  studio?: { type: JobType; modelSlug?: string };
}

/** Carousel Nổi bật trên Home — Leonardo-style, scroll ngang. */
export const FEATURED_MODELS: FeaturedModelItem[] = [
  {
    id: 'seedance-25',
    label: 'Seedance 2.5',
    to: '/video',
    mediaKind: 'video',
    src: 'https://cdn.leonardo.ai/static/images/models/bytedance/seedance-2.5.webm',
    studio: { type: 'video', modelSlug: 'seedance-2-omni' },
  },
  {
    id: 'kling-video',
    label: 'Kling',
    to: '/video',
    mediaKind: 'video',
    src: 'https://cdn.leonardo.ai/static/images/video/models/hailuo-03.webm',
  },
  {
    id: 'create-image',
    label: 'Create Image',
    to: '/image',
    mediaKind: 'image',
    src: 'https://cdn.leonardo.ai/static/images/create_an_image.webp',
  },
  {
    id: 'logo-creator',
    label: 'Logo Creator',
    to: '/image',
    mediaKind: 'image',
    src: 'https://cdn.leonardo.ai/blueprint_assets/official/384ab5c8-55d8-47a1-be22-6a274913c324/thumbnails/thumbnail-f5edb8.webp',
  },
  {
    id: 'branding',
    label: 'Branding',
    to: '/image',
    mediaKind: 'image',
    src: 'https://cdn.leonardo.ai/static/images/consistent_branding.webp',
  },
  {
    id: 'how-to-use-agi',
    label: 'How to use AGI',
    to: '/chat',
    mediaKind: 'image',
    src: 'https://assets.leonardo.ai/acUcV5GXnQHGY_Sn_nano-banana-prompt-guide-example.jpg?auto=compress%2Cformat&fit=max&q=80&w=960',
  },
  {
    id: 'background-change',
    label: 'Background Change',
    to: '/image',
    mediaKind: 'image',
    src: 'https://cdn.leonardo.ai/blueprint_assets/official/384ab5c8-55d8-47a1-be22-6a274913c324/thumbnails/thumbnail-ec50ac.webp',
  },
  {
    id: 'spaces',
    label: 'Spaces',
    to: '/workflow',
    mediaKind: 'image',
    src: magnificSrc('spaces', 720, 960, 78),
  },
  {
    id: 'text-to-speech',
    label: 'Audio',
    to: '/audio',
    mediaKind: 'image',
    src: magnificSrc('text-to-speech', 720, 960, 78),
  },
  {
    id: 'upscale',
    label: 'Upscale',
    to: '/image',
    mediaKind: 'image',
    src: magnificSrc('video-upscaler', 720, 960, 78),
  },
  {
    id: 'background-remover',
    label: 'Remove Background',
    to: '/image',
    mediaKind: 'image',
    src: magnificSrc('background-remover', 720, 960, 78),
  },
];
