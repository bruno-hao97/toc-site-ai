import {
  LANDING_MEDIA,
  type LandingMediaSlot,
  magnificSizes,
  magnificSrc,
  magnificSrcSet,
} from '../../lib/landingMedia';

interface Props {
  slot?: LandingMediaSlot;
  /** URL tùy chỉnh — bỏ qua Magnific CDN khi có. */
  src?: string;
  alt: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
}

export default function LandingShot({
  slot,
  src,
  alt,
  priority = false,
  sizes,
  className = '',
}: Props) {
  if (src) {
    return (
      <figure className={`landing-shot${className ? ` ${className}` : ''}`}>
        <img
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : undefined}
          decoding="async"
        />
      </figure>
    );
  }

  if (!slot) return null;

  const slug = LANDING_MEDIA[slot];

  return (
    <figure className={`landing-shot${className ? ` ${className}` : ''}`}>
      <img
        src={magnificSrc(slug)}
        srcSet={magnificSrcSet(slug)}
        sizes={sizes ?? magnificSizes()}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        decoding="async"
      />
    </figure>
  );
}
