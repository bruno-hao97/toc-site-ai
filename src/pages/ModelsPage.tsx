import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  DollarSign,
  Image as ImageIcon,
  Loader2,
  Mic,
  Music,
  Search,
  Sparkles,
  Video,
} from 'lucide-react';
import MarketingPageShell from '../components/MarketingPageShell';
import ModelCatalogDetailModal from '../components/ModelCatalogDetailModal';
import { isLoggedIn } from '../services/authStore';
import { modelSlug } from '../services/modelSchema';
import {
  CATALOG_TYPE_LABELS,
  fetchAllPublicModels,
  modelCreditsLabel,
  modelFeatureTags,
  modelStatLine,
  providerLabel,
  studioRouteForModel,
  studioStateForModel,
  uniqueProviders,
  type CatalogModel,
  type ModelCatalogType,
} from '../services/publicModelsApi';

type CategoryFilter = 'all' | ModelCatalogType | 'trend';

const CATEGORY_TABS: Array<{ id: CategoryFilter; label: string }> = [
  { id: 'all', label: 'Tất cả' },
  { id: 'video', label: 'Video' },
  { id: 'image', label: 'Hình ảnh' },
  { id: 'tts', label: 'Audio / TTS' },
  { id: 'music', label: 'Nhạc' },
  { id: 'avatar-lipsync', label: 'Avatar Lipsync' },
  { id: 'trend', label: 'Trend' },
];

function TypeIcon({ type }: { type: ModelCatalogType }) {
  const props = { size: 18, strokeWidth: 1.75, 'aria-hidden': true as const };
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

function ModelCard({
  model,
  onDetail,
}: {
  model: CatalogModel;
  onDetail: (model: CatalogModel) => void;
}) {
  const loggedIn = isLoggedIn();
  const tags = modelFeatureTags(model, model.catalogType);
  const stats = modelStatLine(model);
  const credits = modelCreditsLabel(model);
  const tryTarget = loggedIn
    ? { to: studioRouteForModel(model), state: studioStateForModel(model) }
    : { to: '/login', state: undefined };

  return (
    <article className="model-catalog-card">
      <header className="model-catalog-card-head">
        <span className="model-catalog-card-icon">
          <TypeIcon type={model.catalogType} />
        </span>
        <div className="model-catalog-card-title-wrap">
          <h3>{model.name || modelSlug(model)}</h3>
          <span className="model-catalog-provider">@ {providerLabel(model.server)}</span>
        </div>
        <span className="model-catalog-type-pill">{CATALOG_TYPE_LABELS[model.catalogType]}</span>
      </header>

      {model.description ? (
        <p className="model-catalog-desc">{model.description}</p>
      ) : null}

      {tags.length > 0 && (
        <div className="model-catalog-tags">
          {tags.map((tag) => (
            <span key={tag} className="model-catalog-tag">
              {tag}
            </span>
          ))}
        </div>
      )}

      {stats ? <p className="model-catalog-stats">{stats}</p> : null}

      <footer className="model-catalog-card-foot">
        {credits ? (
          <span className="model-catalog-price">
            <DollarSign size={13} strokeWidth={2} aria-hidden />
            {credits}
          </span>
        ) : (
          <span />
        )}
        <div className="model-catalog-actions">
          <button type="button" className="model-catalog-detail-btn" onClick={() => onDetail(model)}>
            Chi tiết
          </button>
          <Link to={tryTarget.to} state={tryTarget.state} className="model-catalog-cta">
            Tạo ngay
            <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
      </footer>
    </article>
  );
}

export default function ModelsPage() {
  const [models, setModels] = useState<CatalogModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [provider, setProvider] = useState('');
  const [detailModel, setDetailModel] = useState<CatalogModel | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    fetchAllPublicModels()
      .then((items) => {
        if (!active) return;
        setModels(items);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const providers = useMemo(() => uniqueProviders(models), [models]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return models.filter((m) => {
      if (category === 'trend') {
        const sale = Number(m.sale || 0);
        if (sale <= 0 && !m.name?.toLowerCase().includes('seedance')) return false;
      } else if (category !== 'all' && m.catalogType !== category) {
        return false;
      }
      if (provider && m.server?.toLowerCase() !== provider) return false;
      if (!q) return true;
      const hay = `${m.name} ${m.description} ${m.server} ${modelSlug(m)}`.toLowerCase();
      return hay.includes(q);
    });
  }, [models, query, category, provider]);

  return (
    <MarketingPageShell className="models-page">
      <section className="marketing-hero models-hero">
        <div className="container">
          <p className="marketing-kicker">Nền tảng AI Toàn diện</p>
          <h1>Danh Sách Model AI</h1>
          <p className="marketing-lead models-hero-lead">
            Khám phá bộ sưu tập các model tốt cho video, hình ảnh, âm thanh và nhạc. Chọn công cụ
            phù hợp nhất cho dự án của bạn.
            {!loading && models.length > 0 ? (
              <span className="models-count"> — {models.length} model</span>
            ) : null}
          </p>
        </div>
      </section>

      <section className="models-toolbar-wrap">
        <div className="models-toolbar-inner">
          <div className="container models-toolbar-container">
            <label className="models-search">
              <Search size={16} aria-hidden />
              <input
                ref={searchRef}
                type="search"
                placeholder="Tìm kiếm model (Ctrl + K)…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>

            <div className="models-tabs" role="tablist" aria-label="Loại model">
              {CATEGORY_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={category === tab.id}
                  className={`models-tab${category === tab.id ? ' active' : ''}`}
                  onClick={() => setCategory(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {providers.length > 0 && (
          <div className="models-providers-scroll" aria-label="Nhà cung cấp">
            <div className="models-providers-track">
              <button
                type="button"
                className={`models-provider-chip${provider === '' ? ' active' : ''}`}
                onClick={() => setProvider('')}
              >
                Tất cả
              </button>
              {providers.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`models-provider-chip${provider === p ? ' active' : ''}`}
                  onClick={() => setProvider(p)}
                >
                  {providerLabel(p)}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="models-grid-section">
        <div className="container">
          {loading && (
            <p className="models-status">
              <Loader2 size={18} className="spin" /> Đang tải models…
            </p>
          )}
          {error && <p className="models-status models-status--error">{error}</p>}
          {!loading && !error && !visible.length && (
            <p className="models-status">Không tìm thấy model phù hợp.</p>
          )}

          <div className="models-grid">
            {visible.map((model) => (
              <ModelCard
                key={`${model.catalogType}-${modelSlug(model)}`}
                model={model}
                onDetail={setDetailModel}
              />
            ))}
          </div>
        </div>
      </section>

      <ModelCatalogDetailModal model={detailModel} onClose={() => setDetailModel(null)} />
    </MarketingPageShell>
  );
}
