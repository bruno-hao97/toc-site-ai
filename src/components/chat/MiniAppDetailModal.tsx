import { useEffect } from 'react';
import MiniAppDetailView from './MiniAppDetailView';
import type { MiniAppItem } from '../../services/miniAppsApi';

interface Props {
  app: MiniAppItem | null;
  onClose: () => void;
}

export default function MiniAppDetailModal({ app, onClose }: Props) {
  useEffect(() => {
    if (!app) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [app, onClose]);

  if (!app) return null;

  return (
    <div className="mini-app-detail-overlay" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={app.name}>
        <MiniAppDetailView app={app} variant="overlay" onBack={onClose} />
      </div>
    </div>
  );
}
