import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useHistoryUpdated } from '../hooks/useHistoryUpdated';
import {
  JOB_TYPES,
  clearHistory,
  isMediaUrl,
  isValidHistoryType,
  listHistory,
  removeHistoryEntry,
  countHistoryGrouped,
  type HistoryEntry,
  type HistoryType,
} from '../services/historyStore';
import { REUSABLE_JOB_TYPES, studioRouteForType } from '../constants/studioTypes';
import type { JobType } from '../services/api';

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function truncate(text: string, max = 120): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function typeLabel(type: HistoryType): string {
  return JOB_TYPES.find((t) => t.value === type)?.label ?? type;
}

function HistoryThumb({ entry }: { entry: HistoryEntry }) {
  const kind = isMediaUrl(entry.resultUrl, entry.type);
  if (kind === 'image') {
    return (
      <img
        className="hist-thumb-img"
        src={entry.resultUrl}
        alt=""
        loading="lazy"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }
  if (kind === 'video') {
    return <video className="hist-thumb-vid" src={entry.resultUrl} muted playsInline preload="metadata" />;
  }
  const icon = kind === 'audio' ? '🔊' : '📄';
  return <span className="hist-thumb-icon">{icon}</span>;
}

/** Lịch sử kết quả gen Studio (localStorage) — route /studio-history */
export default function StudioHistoryPage() {
  const { type: typeParam } = useParams<{ type?: string }>();
  const navigate = useNavigate();
  const activeType = isValidHistoryType(typeParam) ? typeParam : null;

  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((n) => n + 1), []);
  useHistoryUpdated(refresh);

  const counts = useMemo(() => countHistoryGrouped(), [tick]);
  const entries = useMemo(() => listHistory(activeType), [activeType, tick]);
  const totalAll = useMemo(() => Object.values(counts).reduce((a, b) => a + b, 0), [counts]);

  function handleDelete(id: string) {
    if (!confirm('Xóa mục này khỏi lịch sử?')) return;
    removeHistoryEntry(id);
    refresh();
  }

  function handleClearTab() {
    if (!activeType) return;
    if (!confirm(`Xóa tất cả lịch sử ${typeLabel(activeType)}?`)) return;
    clearHistory(activeType);
    refresh();
  }

  function handleClearAll() {
    if (!confirm('Xóa toàn bộ lịch sử Studio (localStorage)?')) return;
    clearHistory(null);
    refresh();
  }

  function applyReuse(entry: HistoryEntry) {
    const t = entry.type as JobType;
    if (!REUSABLE_JOB_TYPES.includes(t)) return;
    navigate(studioRouteForType(t), {
      state: {
        reuseHistory: {
          type: t,
          prompt: entry.prompt,
          modelSlug: entry.modelSlug,
          meta: entry.meta,
        },
      },
    });
  }

  return (
    <div className="page view-history">
      <div className="page-head">
        <p className="kicker">Studio</p>
        <h1>Lịch sử tạo nội dung</h1>
        <p className="lead">
          Kết quả gen thành công lưu trên trình duyệt (<code>ai_studio_history</code>).
        </p>
      </div>

      <div className="page-segment-tabs type-tabs">
        <Link to="/studio-history" className={`tab ${activeType === null ? 'active' : ''}`}>
          Tất cả
          {totalAll > 0 && <span className="hist-count">{totalAll}</span>}
        </Link>
        {JOB_TYPES.map((t) => (
          <Link
            key={t.value}
            to={`/studio-history/${t.value}`}
            className={`tab ${activeType === t.value ? 'active' : ''}`}
          >
            {t.icon} {t.label}
            {counts[t.value] > 0 && <span className="hist-count">{counts[t.value]}</span>}
          </Link>
        ))}
      </div>

      <div className="hist-toolbar">
        {activeType && counts[activeType] > 0 && (
          <button type="button" className="btn ghost sm danger-text" onClick={handleClearTab}>
            Xóa tab {typeLabel(activeType)}
          </button>
        )}
        {totalAll > 0 && (
          <button type="button" className="btn ghost sm danger-text" onClick={handleClearAll}>
            Xóa tất cả
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="hist-empty panel">
          <p>Chưa có lịch sử{activeType ? ` ${typeLabel(activeType)}` : ''}.</p>
          <p className="muted">
            Tạo nội dung tại <Link to="/image">Studio</Link> — khi job thành công, kết quả lưu tự động.
          </p>
        </div>
      ) : (
        <div className="hist-grid">
          {entries.map((entry) => (
            <article key={entry.id} className="hist-card panel">
              <a className="hist-thumb" href={entry.resultUrl} target="_blank" rel="noreferrer">
                <HistoryThumb entry={entry} />
              </a>
              <div className="hist-body">
                <div className="hist-meta">
                  <span className="hist-type-tag">{typeLabel(entry.type)}</span>
                  <time className="hist-time">{formatTime(entry.createdAt)}</time>
                </div>
                <p className="hist-prompt" title={entry.prompt}>
                  {entry.prompt ? truncate(entry.prompt) : '—'}
                </p>
                {entry.modelName && <p className="hist-model">{entry.modelName}</p>}
                <div className="hist-actions">
                  <a className="hist-btn" href={entry.resultUrl} target="_blank" rel="noreferrer">Mở</a>
                  <button type="button" className="hist-btn" onClick={() => applyReuse(entry)}>Dùng lại</button>
                  <button type="button" className="hist-btn danger" onClick={() => handleDelete(entry.id)}>Xóa</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
