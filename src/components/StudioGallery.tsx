import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useHistoryUpdated } from '../hooks/useHistoryUpdated';
import type { JobType } from '../services/api';
import {
  isMediaUrl,
  listHistory,
  type HistoryEntry,
  type HistoryType,
} from '../services/historyStore';
import { jobTypeLabel, jobTypeToHistoryType } from '../constants/studioTypes';

export interface SessionItem {
  id: string;
  type: JobType;
  resultUrl: string;
  prompt?: string;
  modelName?: string;
  modelSlug?: string;
  createdAt: string;
}

type GalleryTab = 'current' | 'history';

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('vi-VN', { timeStyle: 'short', dateStyle: 'short' });
  } catch {
    return iso;
  }
}

function truncate(text: string, max = 80): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function GalleryThumb({ url, type }: { url: string; type: HistoryType }) {
  const kind = isMediaUrl(url, type);
  if (kind === 'image') {
    return <img className="sg-thumb-img" src={url} alt="" loading="lazy" />;
  }
  if (kind === 'video') {
    return <video className="sg-thumb-vid" src={url} muted playsInline preload="metadata" />;
  }
  return <span className="sg-thumb-icon">{kind === 'audio' ? '🔊' : '📄'}</span>;
}

function toEntry(item: SessionItem | HistoryEntry): HistoryEntry {
  if ('resultUrl' in item && 'type' in item) {
    return item as HistoryEntry;
  }
  const s = item as SessionItem;
  return {
    id: s.id,
    type: jobTypeToHistoryType(s.type),
    resultUrl: s.resultUrl,
    prompt: s.prompt,
    modelName: s.modelName,
    modelSlug: s.modelSlug,
    createdAt: s.createdAt,
  };
}

export default function StudioGallery({
  jobType,
  sessionItems,
  onReuse,
}: {
  jobType: JobType;
  sessionItems: SessionItem[];
  onReuse: (entry: HistoryEntry) => void;
}) {
  const [tab, setTab] = useState<GalleryTab>('current');
  const [historyTick, setHistoryTick] = useState(0);
  useHistoryUpdated(() => setHistoryTick((n) => n + 1));

  const historyType = jobTypeToHistoryType(jobType);

  const historyItems = useMemo(
    () => listHistory(historyType).slice(0, 24),
    [historyType, historyTick],
  );

  const currentFiltered = sessionItems.filter((s) => s.type === jobType);
  const items = tab === 'current' ? currentFiltered.map(toEntry) : historyItems;

  return (
    <section className="panel studio-gallery">
      <div className="panel-head">
        <h2>Gallery</h2>
        <Link to={`/studio-history/${historyType}`} className="btn ghost sm">
          Xem tất cả
        </Link>
      </div>

      <div className="sg-tabs type-tabs">
        <button
          type="button"
          className={`tab ${tab === 'current' ? 'active' : ''}`}
          onClick={() => setTab('current')}
        >
          Phiên ({currentFiltered.length})
        </button>
        <button
          type="button"
          className={`tab ${tab === 'history' ? 'active' : ''}`}
          onClick={() => setTab('history')}
        >
          Lịch sử ({historyItems.length})
        </button>
      </div>

      {items.length === 0 ? (
        <p className="muted sg-empty">
          {tab === 'current'
            ? `Chưa có kết quả trong phiên ${jobTypeLabel(jobType)}.`
            : `Chưa có lịch sử ${jobTypeLabel(jobType)} đã lưu.`}
        </p>
      ) : (
        <div className="sg-grid">
          {items.map((entry) => (
            <article key={entry.id} className="sg-card">
              <a className="sg-thumb" href={entry.resultUrl} target="_blank" rel="noreferrer">
                <GalleryThumb url={entry.resultUrl} type={entry.type} />
              </a>
              <div className="sg-card-body">
                <p className="sg-prompt" title={entry.prompt}>
                  {entry.prompt ? truncate(entry.prompt) : '—'}
                </p>
                <p className="sg-meta muted">
                  {entry.modelName || entry.modelSlug || '—'} · {formatTime(entry.createdAt)}
                </p>
                <div className="sg-actions">
                  <button type="button" className="hist-btn" onClick={() => onReuse(entry)}>
                    Dùng lại
                  </button>
                  <a className="hist-btn" href={entry.resultUrl} target="_blank" rel="noreferrer">
                    Mở
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
