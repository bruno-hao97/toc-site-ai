import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Download,
  History,
  Image as ImageIcon,
  type LucideIcon,
  Mic,
  Music,
  Search,
  Sparkles,
  TrendingUp,
  Video,
} from 'lucide-react';
import { getCreditsAi, loadAuth } from '../services/authStore';
import {
  fetchUpstreamUsageHistory,
  type UsageHistoryItem,
} from '../services/upstreamUsageHistory';
import { listHistory } from '../services/historyStore';

type PillId = 'image' | 'video' | 'audio' | 'music';
type Category = PillId | 'other';

const PILLS: { id: PillId; label: string }[] = [
  { id: 'image', label: 'Ảnh' },
  { id: 'video', label: 'Video' },
  { id: 'audio', label: 'Audio' },
  { id: 'music', label: 'Nhạc' },
];

const TIME_TABS: { id: string; label: string; days: number | null }[] = [
  { id: 'all', label: 'Tất cả', days: null },
  { id: '7', label: '7 ngày', days: 7 },
  { id: '30', label: '30 ngày', days: 30 },
  { id: '90', label: '3 tháng', days: 90 },
];

const CHART_TABS = [7, 14, 30];

const CATEGORY_STYLE: Record<Category, { color: string; bg: string; icon: LucideIcon }> = {
  image: { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', icon: ImageIcon },
  video: { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', icon: Video },
  audio: { color: '#4ade80', bg: 'rgba(74,222,128,0.12)', icon: Mic },
  music: { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', icon: Music },
  other: { color: 'var(--muted)', bg: 'rgba(255,255,255,0.06)', icon: Sparkles },
};

const STATUS_STYLE: Record<string, { color: string; label: string }> = {
  success: { color: '#4ade80', label: 'Thành công' },
  failed: { color: '#f87171', label: 'Lỗi' },
  pending: { color: '#fbbf24', label: 'Đang xử lý' },
};

const PAGE_SIZE = 20;

function rowCategory(it: UsageHistoryItem): Category {
  const s = `${it.type} ${it.typeLabel}`.toLowerCase();
  if (/image|ảnh/.test(s)) return 'image';
  if (/video/.test(s)) return 'video';
  if (/music|nhạc/.test(s)) return 'music';
  if (/audio|tts|avatar|giọng/.test(s)) return 'audio';
  return 'other';
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatDayLabel(key: string): string {
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const y = new Date(today);
  y.setDate(y.getDate() - 1);
  const yKey = y.toISOString().slice(0, 10);
  if (key === todayKey) return 'Hôm nay';
  if (key === yKey) return 'Hôm qua';
  try {
    return new Date(`${key}T00:00:00`).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return key;
  }
}

function localFallbackRows(): UsageHistoryItem[] {
  return listHistory(null).map((e) => ({
    id: e.id,
    type: e.type,
    typeLabel:
      e.type === 'image'
        ? 'Tạo ảnh'
        : e.type === 'video'
          ? 'Tạo video'
          : /tts|music|avatar/.test(e.type)
            ? 'Tạo audio'
            : e.type,
    model: e.modelName || e.modelSlug,
    prompt: e.prompt,
    status: 'success' as const,
    statusLabel: 'Hoàn tất',
    cost: null,
    balanceAfter: null,
    createdAt: e.createdAt,
  }));
}

function UsageAreaChart({ items, days }: { items: UsageHistoryItem[]; days: number }) {
  const data = useMemo(() => {
    const map = new Map<string, number>();
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      map.set(d.toISOString().slice(0, 10), 0);
    }
    for (const it of items) {
      const key = dayKey(it.createdAt);
      if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.values()];
  }, [items, days]);

  const max = Math.max(1, ...data);
  const w = 600;
  const h = 110;
  const pad = 8;
  const points = data
    .map((count, i) => {
      const x = pad + (i / Math.max(1, data.length - 1)) * (w - pad * 2);
      const y = h - pad - (count / max) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="uh-chart-svg" preserveAspectRatio="none">
      <polyline fill="none" stroke="#4ade80" strokeWidth="1.8" points={points} />
      <polygon
        fill="url(#uhGrad)"
        points={`${pad},${h - pad} ${points} ${w - pad},${h - pad}`}
        opacity="0.9"
      />
      <defs>
        <linearGradient id="uhGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4ade80" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#4ade80" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function UsageHistoryPage() {
  const { type: typeParam } = useParams<{ type?: string }>();

  const [items, setItems] = useState<UsageHistoryItem[]>([]);
  const [source, setSource] = useState<'upstream' | 'local' | 'empty'>('empty');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeTime, setActiveTime] = useState('all');
  const [activeTypes, setActiveTypes] = useState<PillId[]>(
    typeParam && PILLS.some((p) => p.id === typeParam)
      ? [typeParam as PillId]
      : PILLS.map((p) => p.id),
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [chartDays, setChartDays] = useState(14);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    const auth = loadAuth();
    setLoading(true);
    setError('');
    try {
      if (auth?.access_token) {
        const res = await fetchUpstreamUsageHistory(auth.access_token, auth.domain, {});
        if (res.items.length > 0) {
          setItems(res.items);
          setSource('upstream');
          return;
        }
      }
      const local = localFallbackRows();
      setItems(local);
      setSource(local.length > 0 ? 'local' : 'empty');
    } catch {
      const local = localFallbackRows();
      setItems(local);
      setSource(local.length > 0 ? 'local' : 'empty');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleType(id: PillId) {
    setActiveTypes((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
    setPage(1);
  }

  const allTypesActive = activeTypes.length === PILLS.length;

  const filtered = useMemo(() => {
    const timeDays = TIME_TABS.find((t) => t.id === activeTime)?.days ?? null;
    const cutoff = timeDays != null ? Date.now() - timeDays * 86400000 : null;
    const q = searchQuery.trim().toLowerCase();

    return items
      .filter((it) => {
        const cat = rowCategory(it);
        const typeOk = allTypesActive || (cat !== 'other' && activeTypes.includes(cat));
        if (!typeOk) return false;
        if (cutoff != null && new Date(it.createdAt).getTime() < cutoff) return false;
        if (q) {
          const hay = `${it.model ?? ''} ${it.prompt ?? ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [items, activeTime, activeTypes, allTypesActive, searchQuery]);

  // Summary tổng quan (toàn bộ tài khoản, không theo filter)
  const summary = useMemo(() => {
    const total = items.length;
    const creditsUsed = items.reduce((sum, it) => sum + (it.cost != null ? Math.abs(it.cost) : 0), 0);
    const success = items.filter((it) => it.status === 'success').length;
    return {
      total,
      creditsUsed,
      successRate: total ? Math.round((success / total) * 100) : 0,
    };
  }, [items]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIndex = filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const endIndex = Math.min(safePage * PAGE_SIZE, filtered.length);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const groups = useMemo(() => {
    const out: { key: string; label: string; rows: UsageHistoryItem[] }[] = [];
    const index = new Map<string, number>();
    for (const it of pageItems) {
      const key = dayKey(it.createdAt);
      if (!index.has(key)) {
        index.set(key, out.length);
        out.push({ key, label: formatDayLabel(key), rows: [] });
      }
      out[index.get(key)!].rows.push(it);
    }
    return out;
  }, [pageItems]);

  function exportCsv() {
    const header = ['Loại', 'Model', 'Prompt', 'Thời gian', 'Credits', 'Trạng thái'];
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = filtered.map((it) =>
      [
        it.typeLabel || it.type,
        it.model || '',
        it.prompt || '',
        new Date(it.createdAt).toLocaleString('vi-VN'),
        it.cost != null ? String(Math.abs(it.cost)) : '',
        it.statusLabel || it.status,
      ]
        .map(escape)
        .join(','),
    );
    const csv = [header.map(escape).join(','), ...lines].join('\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `usage-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page uh-page">
      <div className="uh-head">
        <div>
          <h1 className="uh-title">
            <History size={18} /> Lịch sử sử dụng
          </h1>
          <p className="uh-sub">Theo dõi model và credit usage của bạn</p>
          {source === 'local' && (
            <p className="uh-fallback">Đang dùng lịch sử Studio local — chưa có billing upstream.</p>
          )}
        </div>
        <button type="button" className="uh-export" onClick={exportCsv} disabled={!filtered.length}>
          <Download size={14} /> Xuất CSV
        </button>
      </div>

      <div className="uh-cards">
        <div className="uh-card">
          <span className="uh-card-label">Tổng lượt gọi</span>
          <span className="uh-card-value">{summary.total.toLocaleString('vi-VN')}</span>
          <span className="uh-card-sub">bản ghi</span>
        </div>
        <div className="uh-card">
          <span className="uh-card-label">Số dư credit</span>
          <span className="uh-card-value accent">{getCreditsAi().toLocaleString('vi-VN')}</span>
          <span className="uh-card-sub">khả dụng</span>
        </div>
        <div className="uh-card">
          <span className="uh-card-label">Credits đã dùng</span>
          <span className="uh-card-value">{summary.creditsUsed.toLocaleString('vi-VN')}</span>
          <span className="uh-card-sub">tổng tiêu thụ</span>
        </div>
        <div className="uh-card">
          <span className="uh-card-label">Tỷ lệ thành công</span>
          <span className="uh-card-value">{summary.successRate}%</span>
          <span className="uh-card-sub">trên tổng job</span>
        </div>
      </div>

      <div className="uh-filters">
        <div className="uh-time-tabs">
          {TIME_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`uh-time-tab ${activeTime === t.id ? 'active' : ''}`}
              onClick={() => {
                setActiveTime(t.id);
                setPage(1);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="uh-search">
          <Search size={14} />
          <input
            type="text"
            placeholder="Tìm model, prompt…"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="uh-pills">
          {PILLS.map((pill) => {
            const active = activeTypes.includes(pill.id);
            const style = CATEGORY_STYLE[pill.id];
            return (
              <button
                key={pill.id}
                type="button"
                className="uh-pill"
                onClick={() => toggleType(pill.id)}
                style={
                  active
                    ? { borderColor: style.color, background: style.bg, color: style.color }
                    : undefined
                }
              >
                {pill.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="uh-chart-card">
        <div className="uh-chart-head">
          <span className="uh-chart-title">
            <TrendingUp size={15} /> Lượt gen theo ngày
          </span>
          <div className="uh-chart-tabs">
            {CHART_TABS.map((d) => (
              <button
                key={d}
                type="button"
                className={`uh-chart-tab ${chartDays === d ? 'active' : ''}`}
                onClick={() => setChartDays(d)}
              >
                {d}N
              </button>
            ))}
          </div>
        </div>
        <UsageAreaChart items={filtered} days={chartDays} />
      </div>

      {loading && <p className="muted uh-status-msg">Đang tải…</p>}
      {error && <p className="error uh-status-msg">{error}</p>}

      {!loading && !filtered.length ? (
        <div className="uh-empty">Chưa có lịch sử phù hợp bộ lọc.</div>
      ) : (
        <div className="uh-table">
          <div className="uh-table-inner">
            <div className="uh-thead">
              <span className="uh-th">Model / Prompt</span>
              <span className="uh-th right">Thời gian</span>
              <span className="uh-th right">Credits</span>
              <span className="uh-th right">Status</span>
            </div>

            {groups.map((group) => (
              <div key={group.key}>
                <div className="uh-group-divider">
                  {group.label} — {new Date(`${group.key}T00:00:00`).toLocaleDateString('vi-VN')}
                </div>
                {group.rows.map((row) => {
                  const cat = rowCategory(row);
                  const style = CATEGORY_STYLE[cat];
                  const Icon = style.icon;
                  const status = STATUS_STYLE[row.status] ?? STATUS_STYLE.pending;
                  return (
                    <div key={row.id} className="uh-row">
                      <div className="uh-row-main">
                        <span className="uh-icon" style={{ background: style.bg }}>
                          <Icon size={14} style={{ color: style.color }} />
                        </span>
                        <div className="uh-row-text">
                          <span className="uh-model">{row.model || row.typeLabel}</span>
                          {row.prompt && <span className="uh-prompt">{row.prompt}</span>}
                        </div>
                      </div>
                      <span className="uh-time right">{formatTime(row.createdAt)}</span>
                      <span className="uh-credits right">
                        {row.cost != null ? `-${Math.abs(row.cost)}` : '—'}
                      </span>
                      <span className="uh-status right">
                        <span
                          className="uh-status-dot"
                          style={{ background: status.color }}
                          title={status.label}
                        />
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {filtered.length > PAGE_SIZE && (
        <div className="uh-pagination">
          <span className="uh-pag-info">
            Hiển thị {startIndex}–{endIndex} trong {filtered.length.toLocaleString('vi-VN')} bản ghi
          </span>
          <div className="uh-pag-btns">
            <button
              type="button"
              className="uh-pag-btn"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ‹
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((n) => n === 1 || n === totalPages || Math.abs(n - safePage) <= 1)
              .map((n, idx, arr) => (
                <span key={n} className="uh-pag-seg">
                  {idx > 0 && n - arr[idx - 1] > 1 && <span className="uh-pag-ellipsis">…</span>}
                  <button
                    type="button"
                    className={`uh-pag-btn ${safePage === n ? 'active' : ''}`}
                    onClick={() => setPage(n)}
                  >
                    {n}
                  </button>
                </span>
              ))}
            <button
              type="button"
              className="uh-pag-btn"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
