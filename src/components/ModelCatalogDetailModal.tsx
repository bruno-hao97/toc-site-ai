import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  DollarSign,
  Image as ImageIcon,
  Mic,
  Music,
  Sparkles,
  Video,
  X,
} from 'lucide-react';
import { isLoggedIn } from '../services/authStore';
import { modelSlug } from '../services/modelSchema';
import {
  CATALOG_TYPE_LABELS,
  isModelNew,
  modelBaseCredits,
  modelFeatureTags,
  modelPriceTableRows,
  providerLabel,
  studioRouteForModel,
  studioStateForModel,
  type CatalogModel,
  type ModelCatalogType,
} from '../services/publicModelsApi';

interface Props {
  model: CatalogModel | null;
  onClose: () => void;
}

function TypeIcon({ type }: { type: ModelCatalogType }) {
  const props = { size: 22, strokeWidth: 1.75, 'aria-hidden': true as const };
  switch (type) {
    case 'video':
    case 'avatar-lipsync':
      return <Video {...props} />;
    case 'image':
      return <ImageIcon {...props} />;
    case 'tts':
      return <Mic {...props} />;
    case 'music':
      return <Music {...props} />;
    default:
      return <Sparkles {...props} />;
  }
}

function formatCredits(n: number): string {
  return n.toLocaleString('vi-VN');
}

export default function ModelCatalogDetailModal({ model, onClose }: Props) {
  useEffect(() => {
    if (!model) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [model, onClose]);

  if (!model) return null;

  const loggedIn = isLoggedIn();
  const tags = modelFeatureTags(model, model.catalogType);
  const priceRows = modelPriceTableRows(model);
  const baseCredits = modelBaseCredits(model);
  const tryTarget = loggedIn
    ? { to: studioRouteForModel(model), state: studioStateForModel(model) }
    : { to: '/login', state: undefined };

  return createPortal(
    <div className="model-detail-backdrop" onClick={onClose}>
      <div
        className="model-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="model-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="model-detail-close" aria-label="Đóng" onClick={onClose}>
          <X size={18} />
        </button>

        <header className="model-detail-head">
          <span className="model-detail-icon">
            <TypeIcon type={model.catalogType} />
          </span>
          <div className="model-detail-title-wrap">
            <div className="model-detail-title-row">
              <h2 id="model-detail-title">{model.name || modelSlug(model)}</h2>
              {isModelNew(model) ? <span className="model-detail-new">NEW</span> : null}
            </div>
            <p className="model-detail-meta">
              @ {providerLabel(model.server)} · {CATALOG_TYPE_LABELS[model.catalogType]}
            </p>
          </div>
        </header>

        {model.description ? (
          <p className="model-detail-desc">{model.description}</p>
        ) : null}

        <section className="model-detail-pricing" aria-label="Bảng giá">
          <h3>
            <DollarSign size={16} aria-hidden />
            Bảng giá chi tiết
          </h3>
          {baseCredits != null && (
            <p className="model-detail-base-price">
              Giá cơ bản: <strong>{formatCredits(baseCredits)} credits</strong>
            </p>
          )}
          {priceRows.length > 0 ? (
            <>
              <p className="model-detail-price-caption">Theo độ phân giải / thời lượng</p>
              <ul className="model-detail-price-table">
                {priceRows.map((row) => (
                  <li key={`${row.label}-${row.credits}`}>
                    <span>{row.label}</span>
                    <strong>{formatCredits(row.credits)} credits</strong>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="model-detail-price-empty">Chưa có bảng giá chi tiết.</p>
          )}
        </section>

        {tags.length > 0 && (
          <section className="model-detail-features" aria-label="Tính năng hỗ trợ">
            <h3>Tính năng hỗ trợ</h3>
            <div className="model-detail-feature-tags">
              {tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </section>
        )}

        <footer className="model-detail-foot">
          <Link to={tryTarget.to} state={tryTarget.state} className="model-detail-use-btn">
            Sử dụng Model này
            <ArrowRight size={16} />
          </Link>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
