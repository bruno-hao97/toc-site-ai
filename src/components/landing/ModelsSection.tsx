import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useRef } from 'react';
import { appEntryPath } from '../../lib/landingConfig';

const models = [
  { name: 'Gemini 1.5 Pro', desc: 'Model AI mạnh nhất của Google tại thời điểm hiện tại', badge: 'MỚI NHẤT', badgeClass: 'badge-new', icon: '♊' },
  { name: 'Google Veo', desc: 'Tạo video 1080p từ mô tả văn bản hoặc hình ảnh', badge: 'TRENDING', badgeClass: 'badge-trending', icon: '▶️' },
  { name: 'Imagen 3', desc: 'Trải nghiệm hình ảnh chất lượng thực với độ chi tiết vượt trội', badge: 'STABLE', badgeClass: 'badge-stable', icon: '🎨' },
  { name: 'Claude 3.5 Sonnet', desc: 'Tiêu chuẩn vàng cho lập trình và suy luận logic nâng cao', badge: 'POPULAR', badgeClass: 'badge-popular', icon: '🤖' },
];

export default function ModelsSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const appPath = appEntryPath();

  return (
    <section id="models" className="models-section" ref={ref}>
      <div className="container">
        <div className="models-header">
          <div>
            <h2>Các Model Phổ Biến</h2>
            <p className="models-header-sub">Khám phá các model AI được sử dụng nhiều nhất</p>
          </div>
          <a href="#models" className="view-all-link">
            Xem tất cả Model <ArrowRight size={14} />
          </a>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="models-grid"
        >
          {models.map((model) => (
            <article key={model.name} className="model-card">
              <span className={`model-badge ${model.badgeClass}`}>{model.badge}</span>
              <span className="model-icon">{model.icon}</span>
              <h3 className="model-name">{model.name}</h3>
              <p className="model-desc">{model.desc}</p>
              <Link to={appPath} className="model-btn">
                Thử ngay
              </Link>
            </article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
