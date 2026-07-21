import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { appEntryPath } from '../../lib/landingConfig';

const plans = [
  {
    icon: '🎙️',
    name: 'Giọng nói & Dịch',
    fromPrice: '0.2',
    unit: 'credits/1K ký tự',
    features: ['ElevenLabs & Mumax', 'Đa ngôn ngữ & Cảm xúc'],
    featured: false,
  },
  {
    icon: '🖼️',
    name: 'Hình ảnh',
    fromPrice: '50',
    unit: 'credits/ảnh',
    features: [
      'Nano Babana Pro & Midjourney & Kling O1 & Sandrum...',
      'Tạo ảnh siêu tốc',
      'Quyền thương mại',
    ],
    featured: true,
  },
  {
    icon: '▶️',
    name: 'Video',
    fromPrice: '500',
    unit: 'credits/video',
    features: [
      'Kling O1 & Google Veo & Sora & Huber...',
      'Chất lượng 1080p',
      'Chuyển đổi thương mại',
    ],
    featured: false,
  },
];

export default function PricingSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const appPath = appEntryPath();

  return (
    <section id="pricing" className="pricing-section" ref={ref}>
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
        >
          <h2>Chi trả tiền cho những gì bạn dùng.</h2>
          <p className="pricing-subtitle">
            Không phí thuê bao. Không phí ẩn. Giá dựa trên Model API.
          </p>

          <div className="pricing-grid">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={`pricing-card${plan.featured ? ' featured' : ''}`}
              >
                {plan.featured && <span className="featured-badge">Phổ biến</span>}
                <div className="pricing-icon">{plan.icon}</div>
                <h3 className="pricing-name">{plan.name}</h3>
                <span className="price-from">From</span>
                <span className="price-num">{plan.fromPrice}</span>
                <span className="price-unit">{plan.unit}</span>
                <hr />
                <ul className="feature-list">
                  {plan.features.map((f) => (
                    <li key={f}>
                      <span className="feature-check">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to={appPath}
                  className={`pricing-cta${plan.featured ? ' solid' : ' ghost'}`}
                >
                  Bắt đầu ngay
                </Link>
              </article>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
