import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import MarketingPageShell from '../components/MarketingPageShell';
import {
  FEATURE_SECTIONS,
  FEATURE_STATS,
  type FeatureItem,
  type FeatureSection,
} from '../config/featuresCatalog';
import { appEntryPath } from '../lib/landingConfig';
import { isLoggedIn } from '../services/authStore';

const CLOSING_TRUST = [
  '50+ model',
  'Credits minh bạch',
  'Studio · Workflow · API',
] as const;

function FeatureCards({
  items,
  gridClassName = 'features-grid',
}: {
  items: FeatureItem[];
  gridClassName?: string;
}) {
  return (
    <div className={gridClassName}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <article key={item.id} className="features-card">
            <span className="features-card-icon">
              <Icon size={22} strokeWidth={1.75} />
            </span>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </article>
        );
      })}
    </div>
  );
}

function FeatureSectionBlock({
  section,
  index,
}: {
  section: FeatureSection;
  index: number;
}) {
  const isSplit = section.layout === 'split' || section.layout === 'split-reverse';
  const isSplitReverse = section.layout === 'split-reverse';

  return (
    <section
      id={section.id}
      className={`features-section${section.items.length <= 2 ? ' features-section--duo' : ''}${
        isSplit ? ' features-section--split' : ''
      }${isSplitReverse ? ' features-section--split-reverse' : ''}${
        index % 2 === 1 ? ' features-section--alt' : ''
      }`}
    >
      <div className="features-section-ambient" aria-hidden />
      <div className="container">
        {isSplit ? (
          <div className="features-section-split">
            <header className="features-section-head features-section-head--split">
              <p className="features-section-tag">{section.tag}</p>
              <h2>{section.title}</h2>
              <p className="features-section-sub">{section.subtitle}</p>
            </header>
            <FeatureCards items={section.items} gridClassName="features-grid features-grid--split" />
          </div>
        ) : (
          <>
            <header className="features-section-head">
              <p className="features-section-tag">{section.tag}</p>
              <h2>{section.title}</h2>
              <p className="features-section-sub">{section.subtitle}</p>
            </header>
            <FeatureCards items={section.items} />
          </>
        )}
      </div>
    </section>
  );
}

export default function FeaturesPage() {
  const loggedIn = isLoggedIn();
  const appPath = appEntryPath();
  const startPath = loggedIn ? appPath : '/register';

  return (
    <MarketingPageShell className="features-page">
      <section className="marketing-hero features-hero">
        <div className="container">
          <p className="marketing-kicker">Nền tảng AI toàn diện</p>
          <h1>Một studio. Mọi loại nội dung.</h1>
          <p className="marketing-lead">
            Ảnh, video, giọng nói, nhạc — 50+ model, một giao diện, trả theo credits.
          </p>

          <div className="features-stats">
            {FEATURE_STATS.map((stat) => (
              <div key={stat.label} className="features-stat">
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>

          <div className="features-hero-actions">
            <Link to={appPath} className="marketing-cta">
              Bắt đầu ngay
            </Link>
            <Link to="/models" className="marketing-cta marketing-cta--ghost">
              Xem Models
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <div className="features-catalog">
        {FEATURE_SECTIONS.map((section, index) => (
          <FeatureSectionBlock key={section.id} section={section} index={index} />
        ))}
      </div>

      <section className="features-closing-cta" aria-labelledby="features-closing-heading">
        <div className="container">
          <div className="features-closing-cta-panel">
            <div className="features-closing-cta-glow" aria-hidden />
            <div className="features-closing-cta-grid" aria-hidden />

            <span className="features-closing-cta-icon" aria-hidden>
              <Sparkles size={26} strokeWidth={1.75} />
            </span>

            <h2 id="features-closing-heading">Sẵn sàng tạo thử?</h2>
            <p className="features-closing-cta-lead">
              Đăng ký miễn phí — không cần thẻ. Vào studio và chạy model đầu tiên trong phút.
            </p>

            <ul className="features-closing-cta-trust">
              {CLOSING_TRUST.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>

            <div className="features-closing-cta-actions">
              <Link to={startPath} className="features-closing-cta-primary">
                <Sparkles size={16} strokeWidth={2} aria-hidden />
                {loggedIn ? 'Vào studio ngay' : 'Bắt đầu miễn phí'}
                <ArrowRight size={16} aria-hidden />
              </Link>
              <Link to="/pricing" className="features-closing-cta-secondary">
                Xem bảng giá
              </Link>
            </div>
          </div>
        </div>
      </section>
    </MarketingPageShell>
  );
}
