import { Link } from 'react-router-dom';
import { magnificSrc, TOOL_CAROUSEL } from '../../lib/landingMedia';

const TOOL_ROUTES: Record<(typeof TOOL_CAROUSEL)[number]['slug'], string> = {
  spaces: '/workflow',
  'ai-icon-generator': '/image',
  'ai-video-generator': '/video',
  'text-to-speech': '/audio',
  'video-upscaler': '/image',
  'background-remover': '/image',
};

export default function HomeFeaturedTools() {
  return (
    <section className="home-featured" aria-label="Công cụ nổi bật">
      <h2 className="home-featured-title">Nổi bật</h2>

      <div className="home-featured-track">
        {TOOL_CAROUSEL.map(({ slug, label }) => (
          <Link key={slug} to={TOOL_ROUTES[slug]} className="home-featured-card">
            <span className="home-featured-card-thumb">
              <img
                src={magnificSrc(slug, 720, 960, 78)}
                alt=""
                aria-hidden
                loading="lazy"
                decoding="async"
              />
              <span className="home-featured-card-overlay" aria-hidden />
              <span className="home-featured-card-label">{label}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
