import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  Activity,
  AtSign,
  Calendar,
  Camera,
  Check,
  Clock,
  Copy,
  LineChart,
  type LucideIcon,
  Mail,
  ShieldCheck,
  Video,
  Zap,
} from 'lucide-react';
import {
  getCreditsAi,
  getDisplayUser,
  getUpstreamMe,
  refreshSession,
} from '../services/authStore';
import { listHistory } from '../services/historyStore';
import { APP_SITE_URL } from '../services/settingsStore';

const UPGRADE_FEATURES = [
  'Credits không giới hạn',
  'Ưu tiên xử lý GPU',
  'API rate limit cao hơn',
  'Hỗ trợ ưu tiên 24/7',
];

function formatJoined(ts?: number): string {
  if (!ts) return '—';
  try {
    return new Date(ts * 1000).toLocaleDateString('vi-VN', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function initials(name: string | null, email: string): string {
  const base = (name || email || 'U').trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

function activityScore(): { label: string; level: 'high' | 'mid' | 'low' } {
  const weekAgo = Date.now() - 7 * 86400000;
  const recent = listHistory(null).filter((e) => new Date(e.createdAt).getTime() >= weekAgo).length;
  if (recent >= 10) return { label: 'High', level: 'high' };
  if (recent >= 3) return { label: 'Medium', level: 'mid' };
  return { label: 'Low', level: 'low' };
}

const CHART_TABS: { days: number; label: string }[] = [
  { days: 7, label: '7N' },
  { days: 14, label: '14N' },
  { days: 30, label: '30N' },
];

function UsageChart({ days }: { days: number }) {
  const data = useMemo(() => {
    const map = new Map<string, number>();
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      map.set(d.toISOString().slice(0, 10), 0);
    }
    for (const e of listHistory(null)) {
      const key = e.createdAt.slice(0, 10);
      if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].map(([day, count]) => ({ day, count }));
  }, [days]);

  const max = Math.max(1, ...data.map((d) => d.count));
  const w = 560;
  const h = 120;
  const pad = 8;
  const points = data
    .map((d, i) => {
      const x = pad + (i / Math.max(1, data.length - 1)) * (w - pad * 2);
      const y = h - pad - (d.count / max) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="profile-chart">
      <svg viewBox={`0 0 ${w} ${h}`} className="profile-chart-svg" preserveAspectRatio="none">
        <polyline fill="none" stroke="var(--accent)" strokeWidth="2" points={points} />
        <polygon
          fill="url(#chartGrad)"
          points={`${pad},${h - pad} ${points} ${w - pad},${h - pad}`}
          opacity="0.25"
        />
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

function StatCard({
  accent,
  icon: Icon,
  value,
  label,
  badge,
}: {
  accent: string;
  icon: LucideIcon;
  value: string;
  label: string;
  badge: string;
}) {
  return (
    <article className="stat-card" style={{ '--stat-accent': accent } as CSSProperties}>
      <span className="stat-badge">{badge}</span>
      <Icon className="stat-icon" size={16} style={{ color: accent }} />
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </article>
  );
}

export default function ProfilePage() {
  const [me, setMe] = useState(getUpstreamMe());
  const [credits, setCredits] = useState(getCreditsAi());
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [chartDays, setChartDays] = useState(14);
  const user = getDisplayUser();
  const score = useMemo(() => activityScore(), [me]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const s = await refreshSession();
      setMe(s.upstream_me);
      setCredits(s.upstream_me.balancesInfo?.credits_ai ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const info = me?.userInfo;
  const cover = info?.cover as string | undefined;
  const verified = info?.verify_email === 1 || info?.activate === 1;
  const planActive = info?.activate === 1;
  const planLabel = (info?.partner_level_key as string | undefined)?.trim() || 'Free';

  async function copyId() {
    const id = info?.id_base || '';
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="page profile-79">
      <div
        className="profile-cover"
        style={cover ? { backgroundImage: `url(${cover})` } : undefined}
      >
        {verified && (
          <span className="profile-verified">
            <ShieldCheck size={12} /> Verified Account
          </span>
        )}
        <div className="profile-cover-edit">
          <Camera size={14} /> Thay đổi ảnh bìa
        </div>
      </div>

      <div className="profile-hero">
        <div className="profile-hero-left">
          <div className="profile-hero-avatar-wrap">
            {info?.avatar ? (
              <img src={info.avatar} alt="" className="profile-hero-avatar" />
            ) : (
              <span className="profile-hero-avatar profile-hero-avatar-initials">
                {initials(user.name, user.email)}
              </span>
            )}
            {verified && (
              <span className="profile-verified-dot" title="Verified">
                <Check size={11} />
              </span>
            )}
          </div>
          <div>
            <h1 className="profile-hero-name">
              {user.name || '—'}
              <span className="profile-role-badge">{info?.role || 'USER'}</span>
            </h1>
            <div className="profile-meta">
              <span className="profile-meta-item">
                <AtSign size={13} />
                {info?.username || '—'}
              </span>
              <span className="profile-meta-item">
                <Mail size={13} />
                {user.email || '—'}
              </span>
              <span className="profile-meta-item">
                <Calendar size={13} />
                Tham gia {formatJoined(info?.created_time)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="profile-body">
        <div className="profile-main">
          <div className="profile-section-head">
            <span className="profile-section-label">
              <Zap size={14} /> Tổng quan hiệu suất
            </span>
            <button
              type="button"
              className="profile-refresh"
              onClick={refresh}
              disabled={loading}
            >
              {loading ? 'Đang tải…' : '↻ Cập nhật'}
            </button>
          </div>

          <div className="profile-stats-grid">
            <StatCard
              accent="#4ADE80"
              icon={Zap}
              value={credits.toLocaleString('vi-VN')}
              label="Credits khả dụng"
              badge="Live"
            />
            <StatCard
              accent="#60A5FA"
              icon={Video}
              value={String(me?.videoCount ?? 0)}
              label="Video đã tạo"
              badge="Update"
            />
            <StatCard
              accent="#FBBF24"
              icon={Clock}
              value={String(me?.runtime ?? 0)}
              label="Thời gian chạy (phút)"
              badge="Update"
            />
            <StatCard
              accent="#F87171"
              icon={Activity}
              value={score.label}
              label="Điểm hoạt động"
              badge="Update"
            />
          </div>

          <section className="panel profile-chart-card">
            <div className="profile-chart-head">
              <span className="profile-chart-title">
                <LineChart size={15} /> Lịch sử sử dụng
              </span>
              <div className="profile-chart-tabs">
                {CHART_TABS.map((tab) => (
                  <button
                    key={tab.days}
                    type="button"
                    className={`profile-chart-tab ${chartDays === tab.days ? 'active' : ''}`}
                    onClick={() => setChartDays(tab.days)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <UsageChart days={chartDays} />
            <p className="profile-chart-hint">
              Hoạt động gen nội dung {chartDays} ngày gần nhất (local time)
            </p>
          </section>
        </div>

        <aside className="profile-sidebar">
          <section className="profile-side-card">
            <h3 className="profile-side-title">Thông tin tài khoản</h3>
            <div className="profile-acc-row">
              <span className="profile-acc-key">Account ID</span>
              <button type="button" className="profile-acc-val mono copyable" onClick={copyId}>
                <span className="profile-acc-id">{info?.id_base || '—'}</span>
                {copied ? <Check size={13} /> : <Copy size={13} />}
              </button>
            </div>
            <div className="profile-acc-row">
              <span className="profile-acc-key">Trạng thái</span>
              <span className={`profile-acc-status ${planActive ? 'active' : ''}`}>
                <span className="profile-acc-dot" />
                {planActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="profile-acc-row">
              <span className="profile-acc-key">Gói hiện tại</span>
              <span className="profile-acc-val">{planLabel}</span>
            </div>
            <div className="profile-acc-row">
              <span className="profile-acc-key">API Domain</span>
              <span className="profile-acc-val mono accent">v2.api.gommo.net</span>
            </div>
          </section>

          <section className="profile-upgrade-card">
            <h3 className="profile-upgrade-title">Nâng lên Pro</h3>
            <p className="profile-upgrade-desc">
              Mở khóa toàn bộ tính năng với tốc độ và giới hạn cao hơn.
            </p>
            <ul className="profile-upgrade-feats">
              {UPGRADE_FEATURES.map((feat) => (
                <li key={feat}>
                  <Check size={13} />
                  {feat}
                </li>
              ))}
            </ul>
            <a
              href={`${APP_SITE_URL}/pricing`}
              target="_blank"
              rel="noreferrer"
              className="btn primary profile-upgrade-btn"
            >
              <Zap size={14} /> Upgrade to Pro
            </a>
          </section>
        </aside>
      </div>
    </div>
  );
}
