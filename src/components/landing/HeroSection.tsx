import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Zap } from 'lucide-react';
import { LANDING_FEATURED_MODELS } from '../../config/landingFeaturedModels';
import { BRAND_NAME } from '../../lib/brand';
import { appEntryPath } from '../../lib/landingConfig';
import { useLandingMotion } from '../../lib/landingMotion';
import { resolveLandingNewestModelNames } from '../../services/landingFeaturedModels';
import LandingShot from './LandingShot';

const heroModelFallback = LANDING_FEATURED_MODELS.slice(0, 3)
  .map((m) => m.name)
  .join(' · ');

export default function HeroSection() {
  const appPath = appEntryPath();
  const { heroCopy, heroShot } = useLandingMotion();
  const [heroModels, setHeroModels] = useState(heroModelFallback);

  useEffect(() => {
    let cancelled = false;
    resolveLandingNewestModelNames(3).then((names) => {
      if (!cancelled && names.length > 0) {
        setHeroModels(names.join(' · '));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="hero">
      <div className="container hero-split">
        <motion.div className="hero-copy" {...heroCopy}>
          <p className="hero-kicker">{heroModels}</p>
          <h1>{BRAND_NAME}</h1>
          <p className="hero-subtitle">
            Nơi tập trung những model AI mới nhất, giá tốt nhất thị trường.
          </p>
          <div className="hero-buttons">
            <Link to={appPath} className="btn-primary">
              <Zap size={16} />
              Truy cập APP
            </Link>
            <Link to="/features" className="btn-secondary">
              Tính năng
              <ArrowRight size={16} />
            </Link>
          </div>
        </motion.div>

        <motion.div className="hero-shot-wrap" {...heroShot}>
          <LandingShot
            slot="hero"
            alt="Spaces & workflow AGI Center"
            priority
            sizes="(min-width: 960px) 44vw, 100vw"
          />
        </motion.div>
      </div>
    </section>
  );
}
