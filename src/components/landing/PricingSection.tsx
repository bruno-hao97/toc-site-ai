import LandingShot from './LandingShot';

const plans = [
  {
    tier: 'Voice',
    name: 'Giọng nói & Dịch',
    fromPrice: '0.2',
    unit: 'credits / 1K ký tự',
    features: ['ElevenLabs & Mumax', 'Đa ngôn ngữ & cảm xúc'],
  },
  {
    tier: 'Image',
    name: 'Hình ảnh',
    fromPrice: '50',
    unit: 'credits / ảnh',
    features: [
      'Nano Babana Pro · Midjourney · Kling O1',
      'Tạo ảnh siêu tốc',
      'Quyền thương mại',
    ],
  },
  {
    tier: 'Video',
    name: 'Video',
    fromPrice: '500',
    unit: 'credits / video',
    features: [
      'Kling O1 · Google Veo · Sora',
      'Chất lượng 1080p',
      'Chuyển đổi thương mại',
    ],
  },
];

export default function PricingSection() {
  return (
    <section id="pricing" className="pricing-section">
      <div className="container">
        <div className="split-row pricing-intro">
          <div className="split-copy pricing-head">
            <h2>Chi trả tiền cho những gì bạn dùng</h2>
            <p className="pricing-subtitle">
              Không phí thuê bao. Không phí ẩn. Giá dựa trên Model API.
            </p>
          </div>
          <div className="split-proof">
            <LandingShot
              slot="pricing"
              alt="Video upscale — demo Magnific"
              sizes="(min-width: 960px) 38vw, 100vw"
            />
          </div>
        </div>

        <div className="pricing-grid">
          {plans.map((plan) => (
            <article key={plan.name} className="pricing-card">
              <p className="pricing-tier">{plan.tier}</p>
              <h3 className="pricing-name">{plan.name}</h3>
              <span className="price-num">{plan.fromPrice}</span>
              <span className="price-unit">{plan.unit}</span>
              <ul className="feature-list">
                {plan.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
