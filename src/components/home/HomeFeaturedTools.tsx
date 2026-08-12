import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { FEATURED_MODELS } from '../../config/featuredModels';
import { featuredLinkState } from '../../utils/featuredStudioNav';

const SCROLL_STEP = 580;

function FeaturedCardMedia({ kind, src }: { kind: 'image' | 'video'; src: string }) {
  if (kind === 'video') {
    return (
      <video
        src={src}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        aria-hidden
      />
    );
  }

  return (
    <img
      src={src}
      alt=""
      aria-hidden
      loading="lazy"
      decoding="async"
    />
  );
}

export default function HomeFeaturedTools() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const updateScrollState = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;

    const { scrollLeft, scrollWidth, clientWidth } = track;
    const overflow = scrollWidth - clientWidth > 4;
    setCanScrollPrev(overflow && scrollLeft > 4);
    setCanScrollNext(overflow && scrollLeft < scrollWidth - clientWidth - 4);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    updateScrollState();

    track.addEventListener('scroll', updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(track);

    return () => {
      track.removeEventListener('scroll', updateScrollState);
      ro.disconnect();
    };
  }, [updateScrollState]);

  function scrollBy(delta: number) {
    trackRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  }

  return (
    <section className="home-featured" aria-label="Công cụ nổi bật">
      <h2 className="home-featured-title">Featured</h2>

      <div
        className={`home-featured-carousel${canScrollNext ? ' home-featured-carousel--fade-right' : ''}${canScrollPrev ? ' home-featured-carousel--fade-left' : ''}`}
      >
        {canScrollPrev ? (
          <button
            type="button"
            className="home-featured-scroll-btn home-featured-scroll-btn--prev"
            aria-label="Xem trước"
            onClick={() => scrollBy(-SCROLL_STEP)}
          >
            <ChevronLeft size={18} strokeWidth={2} aria-hidden />
          </button>
        ) : null}

        <div ref={trackRef} className="home-featured-track">
          {FEATURED_MODELS.map(({ id, label, to, mediaKind, src, studio }) => (
            <Link
              key={id}
              to={to}
              state={featuredLinkState(studio)}
              className="home-featured-card"
            >
              <span className="home-featured-card-thumb">
                <FeaturedCardMedia kind={mediaKind} src={src} />
                <span className="home-featured-card-overlay" aria-hidden />
                <span className="home-featured-card-label">{label}</span>
              </span>
            </Link>
          ))}
        </div>

        {canScrollNext ? (
          <button
            type="button"
            className="home-featured-scroll-btn home-featured-scroll-btn--next"
            aria-label="Xem thêm"
            onClick={() => scrollBy(SCROLL_STEP)}
          >
            <ChevronRight size={18} strokeWidth={2} aria-hidden />
          </button>
        ) : null}
      </div>
    </section>
  );
}
