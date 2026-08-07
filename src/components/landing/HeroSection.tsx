import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Zap } from 'lucide-react';
import { BRAND_NAME } from '../../lib/brand';
import { appEntryPath } from '../../lib/landingConfig';
import { useLandingMotion } from '../../lib/landingMotion';
import LandingShot from './LandingShot';

export default function HeroSection() {
  const appPath = appEntryPath();
  const { heroCopy, heroShot } = useLandingMotion();

  return (
    <section className="hero">
      <div className="container hero-split">
        <motion.div className="hero-copy" {...heroCopy}>
          <p className="hero-kicker">Kling O1 · Haiwei Babana Pro</p>
          <h1>{BRAND_NAME}</h1>
          <p className="hero-subtitle">
            Nơi tập trung những model AI mới nhất, giá tốt nhất thị trường.
          </p>
          <div className="hero-buttons">
            <Link to={appPath} className="btn-primary">
              <Zap size={16} />
              Truy cập APP
            </Link>
            <a href="#features" className="btn-secondary">
              Khám phá API
              <ArrowRight size={16} />
            </a>
          </div>
        </motion.div>

        <motion.div className="hero-shot-wrap" {...heroShot}>
          <LandingShot
            slot="hero"
            alt="Spaces & workflow — demo Magnific"
            priority
            sizes="(min-width: 960px) 44vw, 100vw"
            showCaption
          />
        </motion.div>
      </div>
    </section>
  );
}
