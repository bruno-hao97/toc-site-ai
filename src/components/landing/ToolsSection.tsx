import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Eraser, GitBranch, Image, Mic, Scan, Video } from 'lucide-react';
import { magnificSrc, TOOL_CAROUSEL } from '../../lib/landingMedia';
import { useLandingMotion } from '../../lib/landingMotion';

const TOOL_ICONS: Record<(typeof TOOL_CAROUSEL)[number]['slug'], LucideIcon> = {
  spaces: GitBranch,
  'ai-icon-generator': Image,
  'ai-video-generator': Video,
  'text-to-speech': Mic,
  'video-upscaler': Scan,
  'background-remover': Eraser,
};

export default function ToolsSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const motionCfg = useLandingMotion();

  return (
    <section className="tools-section" aria-label="Công cụ AGI Center">
      <div className="container">
        <div className="tools-section-head">
          <h2>Một nền tảng, mọi modality</h2>
          <p>Spaces, ảnh, video, giọng nói, upscale và xóa nền — cùng một cổng credits.</p>
        </div>

        <motion.div
          ref={ref}
          className="tool-cards-grid"
          variants={motionCfg.stagger}
          initial="hidden"
          animate={inView ? 'show' : 'hidden'}
        >
          {TOOL_CAROUSEL.map(({ slug, label, accent }) => {
            const Icon = TOOL_ICONS[slug];
            return (
              <motion.article key={slug} className="tool-card" variants={motionCfg.staggerItem}>
                <div className="tool-card-thumb">
                  <img
                    src={magnificSrc(slug, 640, 800, 75)}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    decoding="async"
                  />
                  <span className={`tool-card-icon ${accent}`}>
                    <Icon size={22} strokeWidth={1.75} />
                  </span>
                </div>
                <h3>{label}</h3>
              </motion.article>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
