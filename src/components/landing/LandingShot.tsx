import {
  LANDING_MEDIA,
  type LandingMediaSlot,
  magnificSizes,
  magnificSrc,
  magnificSrcSet,
} from '../../lib/landingMedia';

interface Props {
  slot: LandingMediaSlot;
  alt: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
  showCaption?: boolean;
}

export default function LandingShot({
  slot,
  alt,
  priority = false,
  sizes,
  className = '',
  showCaption = false,
}: Props) {
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
      {showCaption ? (
        <figcaption className="landing-shot-cap">Ảnh demo · thay bằng screenshot AGI Center</figcaption>
      ) : null}
    </figure>
  );
}
