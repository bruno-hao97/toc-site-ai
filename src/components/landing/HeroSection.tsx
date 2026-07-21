import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Hexagon, Sparkles, Zap } from 'lucide-react';
import { appEntryPath } from '../../lib/landingConfig';

export default function HeroSection() {
  const appPath = appEntryPath();

  return (
    <section className="hero">
      <div className="hero-grid" aria-hidden="true" />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="hero-badge"
      >
        <Sparkles size={14} />
        <span>Model mới có sẵn Kling O1 &amp; Haiwei Babana Pro</span>
        <ArrowRight size={14} />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        AI Center
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="hero-subtitle"
      >
        Nơi tập trung những model AI mới nhất,
        <br />
        giá tốt nhất thị trường.
      </motion.p>

      <motion.p
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.25 }}
        className="hero-tagline"
      >
        Build. Create. Automate with AI
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.35 }}
        className="hero-buttons"
      >
        <Link to={appPath} className="btn-primary">
          <Zap size={16} />
          Truy cập APP
        </Link>
        <a href="#features" className="btn-secondary">
          <Hexagon size={16} />
          Khám phá API
        </a>
      </motion.div>
    </section>
  );
}
