import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { appEntryPath } from '../../lib/landingConfig';
import LandingShot from './LandingShot';

const models = [
  { name: 'Gemini 1.5 Pro', vendor: 'Google', desc: 'Model AI mạnh nhất của Google tại thời điểm hiện tại' },
  { name: 'Google Veo', vendor: 'Video', desc: 'Tạo video 1080p từ mô tả văn bản hoặc hình ảnh' },
  { name: 'Imagen 3', vendor: 'Ảnh', desc: 'Hình ảnh chất lượng cao với độ chi tiết vượt trội' },
  { name: 'Claude 3.5 Sonnet', vendor: 'Code', desc: 'Tiêu chuẩn cho lập trình và suy luận logic nâng cao' },
];

export default function ModelsSection() {
  const appPath = appEntryPath();

  return (
    <section id="models" className="split-section">
      <div className="container split-row">
        <div className="split-copy">
          <div className="models-header">
            <div>
              <h2>Studio &amp; model phổ biến</h2>
              <p className="models-header-sub">Khám phá các model AI được sử dụng nhiều nhất</p>
            </div>
            <a href="#models" className="view-all-link">
              Xem tất cả
              <ArrowRight size={14} />
            </a>
          </div>

          <div className="model-index">
            {models.map((model) => (
              <div key={model.name} className="model-row">
                <div className="model-row-main">
                  <h3>{model.name}</h3>
                  <p>{model.desc}</p>
                </div>
                <span className="model-row-tag">{model.vendor}</span>
                <Link to={appPath} className="model-row-link">
                  Thử ngay →
                </Link>
              </div>
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
