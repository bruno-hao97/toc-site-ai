import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plug, Search, Sparkles, X, Zap } from 'lucide-react';
import {
  fetchBrandDesigns,
  fetchMcpConnectionRequirements,
  fetchMoonixContent,
  filterMoonixSuggestions,
  mcpRequirementDescription,
  mcpRequirementLabel,
  moonixSuggestionAbout,
  moonixSuggestionCategories,
  moonixSuggestionDescription,
  moonixSuggestionFeatures,
  moonixSuggestionName,
  moonixSuggestionPreview,
  moonixSuggestionPrompt,
  type BrandDesignItem,
  type McpConnectionRequirement,
  type MoonixContent,
  type MoonixSuggestion,
} from '../../services/moonixContentApi';

interface Props {
  open: boolean;
  onClose: () => void;
  onUseTemplate: (prompt: string) => void;
}

const COMPLEXITY_LABEL: Record<string, string> = {
  beginner: 'Cơ bản',
  medium: 'Trung bình',
  advanced: 'Nâng cao',
};

function McpRequirementsBanner({ requirements }: { requirements: McpConnectionRequirement[] }) {
  if (!requirements.length) return null;

  return (
    <div className="create-mini-app-mcp" role="note">
      <div className="create-mini-app-mcp-head">
        <Plug size={16} aria-hidden />
        <strong>Cần cấu hình MCP trước khi agent chạy</strong>
      </div>
      <p className="create-mini-app-mcp-lead">
        Agent Code Chat yêu cầu kết nối MCP &amp; CLI. Mở menu hồ sơ → <strong>MCP &amp; CLI</strong> trên
        vmedia để thiết lập, rồi quay lại chọn template.
      </p>
      <ul className="create-mini-app-mcp-list">
        {requirements.map((req, i) => {
          const label = mcpRequirementLabel(req);
          const desc = mcpRequirementDescription(req);
          const key = req.id || req.key || `${label}-${i}`;
          return (
            <li key={key}>
              <span className="create-mini-app-mcp-item-title">{label}</span>
              {desc && <span className="create-mini-app-mcp-item-desc">{desc}</span>}
              {req.docs_url && (
                <a href={req.docs_url} target="_blank" rel="noopener noreferrer">
                  Hướng dẫn
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TemplateCard({
  item,
  onSelect,
}: {
  item: MoonixSuggestion;
  onSelect: (item: MoonixSuggestion) => void;
}) {
  const thumb = moonixSuggestionPreview(item);
  const name = moonixSuggestionName(item);
  const desc = moonixSuggestionDescription(item);

  return (
    <article className="create-mini-app-card">
      <button type="button" className="create-mini-app-card-hit" onClick={() => onSelect(item)}>
        <div
          className="create-mini-app-card-thumb"
          style={thumb ? { backgroundImage: `url(${thumb})` } : undefined}
        />
        <div className="create-mini-app-card-body">
          <div className="create-mini-app-card-meta">
            {item.complexity && (
              <span className="create-mini-app-badge">
                {COMPLEXITY_LABEL[item.complexity] ?? item.complexity}
              </span>
            )}
            {item.auth_required && <span className="create-mini-app-badge create-mini-app-badge--auth">Auth</span>}
          </div>
          <h3>{name}</h3>
          <p>{desc}</p>
          {item.ui_layout && <span className="create-mini-app-layout">{item.ui_layout}</span>}
        </div>
      </button>
    </article>
  );
}

function AboutPreview({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split('\n').slice(0, 24);
  return (
    <div className="create-mini-app-about">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="create-mini-app-about-gap" />;
        if (trimmed.startsWith('# ')) {
          return (
            <h4 key={i} className="create-mini-app-about-h">
              {trimmed.slice(2)}
            </h4>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h5 key={i} className="create-mini-app-about-h2">
              {trimmed.slice(3)}
            </h5>
          );
        }
        if (trimmed.startsWith('- ')) {
          return (
            <li key={i} className="create-mini-app-about-li">
              {trimmed.slice(2)}
            </li>
          );
        }
        return (
          <p key={i} className="create-mini-app-about-p">
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}

function TemplateDetail({
  item,
  brandDesigns,
  onBack,
  onUse,
}: {
  item: MoonixSuggestion;
  brandDesigns: BrandDesignItem[];
  onBack: () => void;
  onUse: (prompt: string) => void;
}) {
  const name = moonixSuggestionName(item);
  const desc = moonixSuggestionDescription(item);
  const features = moonixSuggestionFeatures(item);
  const about = moonixSuggestionAbout(item);
  const prompt = moonixSuggestionPrompt(item);
  const previews = item.preview_images?.filter(Boolean) ?? [];
  const isBrandTemplate = item.category?.key === 'brand' || item.key === 'brand-landing';

  const handleUse = () => {
    if (!prompt) {
      window.alert('Template này chưa có prompt.');
      return;
    }
    onUse(prompt);
  };

  return (
    <div className="create-mini-app-detail">
      <header className="create-mini-app-detail-head">
        <button type="button" className="create-mini-app-back" onClick={onBack}>
          <ArrowLeft size={16} />
          Templates
        </button>
        <button type="button" className="create-mini-app-close" onClick={onBack} aria-label="Đóng chi tiết">
          <X size={18} />
        </button>
      </header>

      {previews.length > 0 && (
        <div className="create-mini-app-detail-previews">
          {previews.map((url) => (
            <img key={url} src={url} alt="" loading="lazy" />
          ))}
        </div>
      )}

      <div className="create-mini-app-detail-scroll">
        <div className="create-mini-app-detail-intro">
          <span className="create-mini-app-detail-kicker">{item.category?.key}</span>
          <h2>{name}</h2>
          <p>{desc}</p>
          <div className="create-mini-app-detail-tags">
            {item.sdks?.map((sdk) => (
              <span key={sdk} className="create-mini-app-chip">
                {sdk}
              </span>
            ))}
            {item.ui_layout && <span className="create-mini-app-chip">{item.ui_layout}</span>}
            {item.languages?.map((lang) => (
              <span key={lang} className="create-mini-app-chip create-mini-app-chip--muted">
                {lang}
              </span>
            ))}
          </div>
        </div>

        {features.length > 0 && (
          <section className="create-mini-app-section">
            <h3>Tính năng</h3>
            <ul className="create-mini-app-features">
              {features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </section>
        )}

        {isBrandTemplate && brandDesigns.length > 0 && (
          <section className="create-mini-app-section">
            <h3>Brand designs của bạn</h3>
            <div className="create-mini-app-brands">
              {brandDesigns.map((b) => (
                <div key={b.id_base ?? b.slug ?? b.name} className="create-mini-app-brand">
                  {(b.avatar_url || b.banner_url) && (
                    <img src={b.avatar_url || b.banner_url} alt="" loading="lazy" />
                  )}
                  <span>{b.name ?? b.slug ?? 'Brand'}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {about && (
          <section className="create-mini-app-section">
            <h3>About</h3>
            <AboutPreview text={about} />
          </section>
        )}
      </div>

      <footer className="create-mini-app-detail-foot">
        <button type="button" className="create-mini-app-use" onClick={handleUse} disabled={!prompt}>
          <Zap size={16} />
          Dùng gợi ý này
        </button>
      </footer>
    </div>
  );
}

export default function CreateMiniAppModal({ open, onClose, onUseTemplate }: Props) {
  const [content, setContent] = useState<MoonixContent | null>(null);
  const [brandDesigns, setBrandDesigns] = useState<BrandDesignItem[]>([]);
  const [mcpRequirements, setMcpRequirements] = useState<McpConnectionRequirement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<MoonixSuggestion | null>(null);

  useEffect(() => {
    if (!open) return;
    setCategory('all');
    setSearch('');
    setSelected(null);
    setLoading(true);
    setError('');
    setContent(null);
    setMcpRequirements([]);

    void Promise.all([
      fetchMoonixContent({ language: 'VI' }),
      fetchBrandDesigns({ language: 'VI' }).catch(() => [] as BrandDesignItem[]),
      fetchMcpConnectionRequirements().catch(() => ({ agent_id: '', requirements: [] as McpConnectionRequirement[] })),
    ])
      .then(([moonix, brands, mcp]) => {
        setContent(moonix);
        setBrandDesigns(brands);
        setMcpRequirements(mcp.requirements);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selected) setSelected(null);
        else onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, selected]);

  const suggestions = content?.suggestions ?? [];
  const categories = useMemo(() => moonixSuggestionCategories(suggestions), [suggestions]);
  const filtered = useMemo(
    () => filterMoonixSuggestions(suggestions, { category, query: search }),
    [suggestions, category, search],
  );

  const home = content?.home;

  if (!open) return null;

  return (
    <div className="create-mini-app-overlay" onClick={onClose}>
      <div
        className={`create-mini-app-modal${selected ? ' create-mini-app-modal--detail' : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Tạo Mini App"
      >
        {selected ? (
          <TemplateDetail
            item={selected}
            brandDesigns={brandDesigns}
            onBack={() => setSelected(null)}
            onUse={onUseTemplate}
          />
        ) : (
          <>
            <header className="create-mini-app-head">
              <div>
                <span className="create-mini-app-eyebrow">
                  <Sparkles size={14} />
                  {home?.eyebrow ?? 'Moonix Code Agent'}
                </span>
                <h2>{home?.title ?? 'Tạo Mini App'}</h2>
                <p>{home?.description ?? 'Chọn template để AI dựng app trong Code Chat.'}</p>
              </div>
              <button type="button" className="create-mini-app-close" onClick={onClose} aria-label="Đóng">
                <X size={18} />
              </button>
            </header>

            <McpRequirementsBanner requirements={mcpRequirements} />

            <div className="create-mini-app-toolbar">
              <div className="create-mini-app-cats" role="tablist" aria-label="Danh mục template">
                {categories.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    role="tab"
                    aria-selected={category === c.key}
                    className={`create-mini-app-cat${category === c.key ? ' create-mini-app-cat--active' : ''}`}
                    onClick={() => setCategory(c.key)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <form className="create-mini-app-search" onSubmit={(e) => e.preventDefault()}>
                <Search size={16} aria-hidden />
                <input
                  type="search"
                  placeholder="Tìm template…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </form>
            </div>

            <div className="create-mini-app-body">
              {loading && <p className="create-mini-app-status">Đang tải catalog…</p>}
              {error && <p className="create-mini-app-status create-mini-app-status--error">{error}</p>}

              {!loading && !error && filtered.length === 0 && (
                <p className="create-mini-app-status">Không tìm thấy template.</p>
              )}

              {!loading && !error && filtered.length > 0 && (
                <div className="create-mini-app-grid">
                  {filtered.map((item) => (
                    <TemplateCard key={item.id} item={item} onSelect={setSelected} />
                  ))}
                </div>
              )}

              {!loading && content?.version?.version && (
                <p className="create-mini-app-version">
                  {content.version.product ?? 'Chat AI'} · v{content.version.version}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
