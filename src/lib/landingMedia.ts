const BASE = 'https://media.magnific.com/landings/tools-carousel';
const WIDTHS = [640, 750, 828, 1080, 1200, 1920, 2048, 3840] as const;

export type LandingMediaSlot = 'hero' | 'studio' | 'chat' | 'pricing' | 'features';

/** Slug Magnific tạm — đổi file/slug khi có ảnh AGI thật. */
export const LANDING_MEDIA: Record<LandingMediaSlot, string> = {
  hero: 'spaces',
  studio: 'ai-icon-generator',
  chat: 'ai-video-generator',
  pricing: 'video-upscaler',
  features: 'background-remover',
};

export const TOOL_CAROUSEL = [
  { slug: 'spaces', label: 'Spaces', accent: 'tool-accent-violet' },
  { slug: 'ai-icon-generator', label: 'Tạo ảnh', accent: 'tool-accent-blue' },
  { slug: 'ai-video-generator', label: 'Tạo video', accent: 'tool-accent-green' },
  { slug: 'text-to-speech', label: 'Giọng nói', accent: 'tool-accent-teal' },
  { slug: 'video-upscaler', label: 'Upscale', accent: 'tool-accent-neutral' },
  { slug: 'background-remover', label: 'Xóa nền', accent: 'tool-accent-rose' },
] as const;

export function magnificSrc(slug: string, w = 1200, h = 1200, q = 75): string {
  return `${BASE}/${slug}.webp?w=${w}&h=${h}&q=${q}`;
}

export function magnificSrcSet(slug: string, h = 1200, q = 75): string {
  return WIDTHS.map((w) => `${BASE}/${slug}.webp?w=${w}&h=${h}&q=${q} ${w}w`).join(', ');
}

export function magnificSizes(defaultSize = '(min-width: 960px) 46vw, 100vw'): string {
  return defaultSize;
}
