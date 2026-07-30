import { useEffect, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import MiniAppCard from './MiniAppCard';
import MiniAppDetailModal from './MiniAppDetailModal';
import MarketsModal from './MarketsModal';
import {
  fetchMarketplaceMiniApps,
  isMiniAppFree,
  miniAppScore,
  type MiniAppItem,
} from '../../services/miniAppsApi';

const STRIP_COUNT = 4;

interface Props {
  enabled?: boolean;
}

export default function ChatMarketplaceStrip({ enabled = true }: Props) {
  const [items, setItems] = useState<MiniAppItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [detailApp, setDetailApp] = useState<MiniAppItem | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    void fetchMarketplaceMiniApps()
      .then((list) => {
        if (!cancelled) setItems(list);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const topFree = useMemo(() => {
    return [...items.filter(isMiniAppFree)]
      .sort((a, b) => miniAppScore(b) - miniAppScore(a))
      .slice(0, STRIP_COUNT);
  }, [items]);

  if (!enabled) return null;

  return (
    <>
      <section className="chat-marketplace" aria-label="Chợ ứng dụng">
        <div className="chat-marketplace-panel">
          <div className="chat-marketplace-head">
            <div>
              <span className="chat-marketplace-kicker">CHỢ ỨNG DỤNG</span>
              <h2 className="chat-marketplace-title">TOP MIỄN PHÍ</h2>
            </div>
            <button
              type="button"
              className="chat-marketplace-all"
              onClick={() => setModalOpen(true)}
              disabled={loading && items.length === 0}
            >
              Xem tất cả
              <ChevronRight size={16} />
            </button>
          </div>

          {loading && topFree.length === 0 && (
            <div className="chat-marketplace-strip chat-marketplace-strip--loading">
              {Array.from({ length: STRIP_COUNT }).map((_, i) => (
                <div key={i} className="mini-app-card mini-app-card--strip mini-app-card--skeleton" />
              ))}
            </div>
          )}

          {error && !loading && topFree.length === 0 && (
            <p className="chat-marketplace-error">{error}</p>
          )}

          {topFree.length > 0 && (
            <div className="chat-marketplace-strip">
              {topFree.map((app) => (
                <MiniAppCard
                  key={app.id_base}
                  app={app}
                  compact
                  onView={setDetailApp}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <MarketsModal
        open={modalOpen}
        initialItems={items.length ? items : undefined}
        onClose={() => setModalOpen(false)}
      />

      <MiniAppDetailModal app={detailApp} onClose={() => setDetailApp(null)} />
    </>
  );
}
