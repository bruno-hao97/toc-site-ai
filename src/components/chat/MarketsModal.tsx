import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, Plus, Search, X } from 'lucide-react';
import MiniAppCard from './MiniAppCard';
import MiniAppDetailView from './MiniAppDetailView';
import CreateMiniAppModal from './CreateMiniAppModal';
import {
  applyMarketFilters,
  countActiveMarketFilters,
  DEFAULT_MARKET_FILTERS,
  fetchMarketplaceMiniApps,
  filterMiniAppsByTab,
  isMiniAppFree,
  miniAppScore,
  type MarketFilters,
  type MarketTab,
  type MiniAppItem,
} from '../../services/miniAppsApi';
import { stashMoonixTemplatePrompt } from '../../services/moonixContentApi';

interface Props {
  open: boolean;
  initialItems?: MiniAppItem[];
  onClose: () => void;
}

const TABS: { id: MarketTab; label: string }[] = [
  { id: 'public', label: 'PUBLIC' },
  { id: 'mine', label: 'CỦA TÔI' },
  { id: 'fun', label: 'VUI VẺ' },
  { id: 'entertainment', label: 'GIẢI TRÍ' },
  { id: 'graphics', label: 'ĐỒ HỌA' },
  { id: 'saved', label: 'ĐÃ LƯU' },
  { id: 'approved', label: 'PHÊ DUYỆT' },
];

function searchMiniApps(items: MiniAppItem[], query: string): MiniAppItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (a) =>
      a.name.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.authorInfo?.name?.toLowerCase().includes(q) ||
      a.tags?.some((t) => t.toLowerCase().includes(q)),
  );
}

export default function MarketsModal({ open, initialItems, onClose }: Props) {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [items, setItems] = useState<MiniAppItem[]>(initialItems ?? []);
  const [tab, setTab] = useState<MarketTab>('public');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<MarketFilters>(DEFAULT_MARKET_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedApp, setSelectedApp] = useState<MiniAppItem | null>(null);

  useEffect(() => {
    if (!open) return;
    setTab('public');
    setSearch('');
    setFilters(DEFAULT_MARKET_FILTERS);
    setFilterOpen(false);
    setSelectedApp(null);
    setCreateOpen(false);
    if (initialItems?.length) {
      setItems(initialItems);
      return;
    }
    setLoading(true);
    setError('');
    void fetchMarketplaceMiniApps()
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [open, initialItems]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedApp) setSelectedApp(null);
        else onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, selectedApp]);

  const openDetail = (app: MiniAppItem) => setSelectedApp(app);

  const filtered = useMemo(() => {
    const byTab = filterMiniAppsByTab(items, tab);
    const byFilters = applyMarketFilters(byTab, filters);
    return searchMiniApps(byFilters, search);
  }, [items, tab, filters, search]);

  const freeApps = useMemo(
    () => [...filtered.filter(isMiniAppFree)].sort((a, b) => miniAppScore(b) - miniAppScore(a)),
    [filtered],
  );
  const paidApps = useMemo(
    () => [...filtered.filter((a) => !isMiniAppFree(a))].sort((a, b) => miniAppScore(b) - miniAppScore(a)),
    [filtered],
  );

  const filterCount = countActiveMarketFilters(filters);
  const showPublicSections = tab === 'public' && !search.trim();

  const onUseTemplate = (prompt: string) => {
    stashMoonixTemplatePrompt(prompt);
    setCreateOpen(false);
    onClose();
    navigate('/chat?create=mini_app');
  };

  if (!open) return null;

  return (
    <>
    <div className="markets-modal-overlay" onClick={onClose}>
      <div
        className={`markets-modal${selectedApp ? ' markets-modal--detail' : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={selectedApp ? selectedApp.name : 'Markets'}
      >
        {!selectedApp && (
          <>
            <header className="markets-modal-head">
              <div>
                <h2>Markets</h2>
                <p>Khám phá hàng nghìn Mini Apps, Designs, Workflow, Agents và Skills.</p>
              </div>
              <button type="button" className="markets-modal-close" onClick={onClose} aria-label="Đóng">
                <X size={18} />
              </button>
            </header>

            <div className="markets-modal-toolbar">
          <div className="markets-modal-toolbar-left">
            <button
              type="button"
              className="markets-modal-tab markets-modal-tab--create"
              onClick={() => setCreateOpen(true)}
            >
              <Plus size={14} />
              Tạo Mini App
            </button>

            <div className="markets-modal-tabs" role="tablist" aria-label="Lọc chợ ứng dụng">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  className={`markets-modal-tab${tab === t.id ? ' markets-modal-tab--active' : ''}`}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              className={`markets-modal-tab markets-modal-tab--filter${filterOpen ? ' markets-modal-tab--active' : ''}`}
              onClick={() => setFilterOpen((v) => !v)}
            >
              <Filter size={13} />
              LỌC ({filterCount})
            </button>
          </div>

          <form
            className="markets-modal-search"
            onSubmit={(e) => e.preventDefault()}
          >
            <Search size={16} aria-hidden />
            <input
              type="search"
              placeholder="Tìm Mini Apps…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="submit" className="markets-modal-search-btn">
              Tìm
            </button>
          </form>
        </div>

        {filterOpen && (
          <div className="markets-modal-filters">
            <label className="markets-modal-filter-check">
              <input
                type="checkbox"
                checked={filters.freeOnly}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    freeOnly: e.target.checked,
                    paidOnly: e.target.checked ? false : f.paidOnly,
                  }))
                }
              />
              Chỉ miễn phí
            </label>
            <label className="markets-modal-filter-check">
              <input
                type="checkbox"
                checked={filters.paidOnly}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    paidOnly: e.target.checked,
                    freeOnly: e.target.checked ? false : f.freeOnly,
                  }))
                }
              />
              Chỉ có phí
            </label>
            <label className="markets-modal-filter-check">
              <input
                type="checkbox"
                checked={filters.ratedOnly}
                onChange={(e) => setFilters((f) => ({ ...f, ratedOnly: e.target.checked }))}
              />
              Có đánh giá
            </label>
            {filterCount > 0 && (
              <button
                type="button"
                className="markets-modal-filter-reset"
                onClick={() => setFilters(DEFAULT_MARKET_FILTERS)}
              >
                Xóa lọc
              </button>
            )}
          </div>
        )}
          </>
        )}

        <div className={`markets-modal-body${selectedApp ? ' markets-modal-body--detail' : ''}`}>
          {selectedApp ? (
            <MiniAppDetailView
              app={selectedApp}
              variant="inline"
              onBack={() => setSelectedApp(null)}
            />
          ) : (
            <>
          {loading && <p className="markets-modal-status">Đang tải…</p>}
          {error && <p className="markets-modal-status markets-modal-status--error">{error}</p>}

          {!loading && !error && tab === 'saved' && filtered.length === 0 && (
            <p className="markets-modal-status">Chưa có Mini App đã lưu.</p>
          )}

          {!loading && !error && tab !== 'saved' && filtered.length === 0 && (
            <p className="markets-modal-status">Không tìm thấy mini app.</p>
          )}

          {showPublicSections ? (
            <>
              {freeApps.length > 0 && (
                <section className="markets-modal-section">
                  <h3>Top ứng dụng miễn phí</h3>
                  <div className="markets-modal-strip">
                    {freeApps.map((app) => (
                      <MiniAppCard key={app.id_base} app={app} compact onView={openDetail} />
                    ))}
                  </div>
                </section>
              )}

              {paidApps.length > 0 && (
                <section className="markets-modal-section">
                  <h3>Top ứng dụng có phí</h3>
                  <div className="markets-modal-showcase-grid">
                    {paidApps.map((app) => (
                      <MiniAppCard key={app.id_base} app={app} showcase onView={openDetail} />
                    ))}
                  </div>
                </section>
              )}
            </>
          ) : (
            filtered.length > 0 && (
              <section className="markets-modal-section">
                <h3>
                  {TABS.find((t) => t.id === tab)?.label ?? 'Kết quả'}
                  {search.trim() ? ` · "${search.trim()}"` : ''}
                </h3>
                <div className="markets-modal-grid">
                  {filtered.map((app) => (
                    <MiniAppCard
                      key={app.id_base}
                      app={app}
                      showcase={!isMiniAppFree(app)}
                      onView={openDetail}
                    />
                  ))}
                </div>
              </section>
            )
          )}
            </>
          )}
        </div>
      </div>
    </div>

    <CreateMiniAppModal
      open={createOpen}
      onClose={() => setCreateOpen(false)}
      onUseTemplate={onUseTemplate}
    />
    </>
  );
}
