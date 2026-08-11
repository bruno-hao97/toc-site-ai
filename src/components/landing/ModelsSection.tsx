import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { LANDING_FEATURED_MODELS, type LandingFeaturedModel } from '../../config/landingFeaturedModels';
import { resolveLandingFeaturedModels } from '../../services/landingFeaturedModels';
import LandingShot from './LandingShot';

export default function ModelsSection() {
  const [models, setModels] = useState<LandingFeaturedModel[]>(LANDING_FEATURED_MODELS);

  useEffect(() => {
    let cancelled = false;
    resolveLandingFeaturedModels().then((next) => {
      if (!cancelled) setModels(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section id="models" className="split-section">
      <div className="container split-row">
        <div className="split-copy">
          <div className="models-header">
            <div>
              <h2>Studio &amp; model phổ biến</h2>
              <p className="models-header-sub">
                4 model mới nhất trên catalog — tự cập nhật từ AGI Center
              </p>
            </div>
            <Link to="/models" className="view-all-link">
              Xem tất cả
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="model-index">
            {models.map((model) => (
              <article key={model.id} className="model-row">
                <div className="model-row-main">
                  <h3>{model.name}</h3>
                  <p>{model.description}</p>
                </div>
                <span className="model-row-tag">{model.tag}</span>
              </article>
            ))}
          </div>
        </div>

        <div className="split-proof">
          <LandingShot
            slot="studio"
            alt="Tạo ảnh & icon — demo Magnific"
            sizes="(min-width: 960px) 42vw, 100vw"
            className="landing-shot-tall"
          />
        </div>
      </div>
    </section>
  );
}
