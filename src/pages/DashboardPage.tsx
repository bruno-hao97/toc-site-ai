import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type DashboardPeriod,
  type DashboardStats,
  type Job,
} from '../services/dashboardTypes';
import { fetchGommoDashboardStats } from '../services/gommoDashboard';
import {
  formatBucketStepLabel,
  MAX_CHART_COLUMNS,
} from '../services/dashboardChartBuckets';
import { useLocale, type TranslateFn } from '../i18n/LanguageProvider';
import type { AppLocale, TranslationKey } from '../i18n/types';

const PERIOD_KEYS: { value: DashboardPeriod; key: TranslationKey }[] = [
  { value: '7d', key: 'dashboard.period.7d' },
  { value: '30d', key: 'dashboard.period.30d' },
  { value: 'all', key: 'dashboard.period.all' },
];

type ActivityTab = 'all' | 'video' | 'image' | 'audio' | 'music';

const ACTIVITY_TAB_KEYS: { id: ActivityTab; key: TranslationKey }[] = [
  { id: 'all', key: 'dashboard.activity.tab.all' },
  { id: 'video', key: 'dashboard.activity.tab.video' },
  { id: 'image', key: 'dashboard.activity.tab.image' },
  { id: 'audio', key: 'dashboard.activity.tab.audio' },
  { id: 'music', key: 'dashboard.activity.tab.music' },
];

const ACTIVITY_PAGE_SIZE = 30;

interface ActivityRow {
  id: string;
  model: string;
  typeLabel: string;
  category: ActivityTab | 'other';
  status: string;
  statusClass: string;
  cost: number | null;
  created_at: string;
}

function dateLocale(locale: AppLocale): string {
  return locale === 'vi' ? 'vi-VN' : 'en-US';
}

function normalizeCategory(type: string): ActivityTab | 'other' {
  const t = type.toLowerCase();
  if (t === 'image') return 'image';
  if (t === 'video' || t === 'avatar-lipsync') return 'video';
  if (t === 'tts' || t.includes('audio')) return 'audio';
  if (t === 'music') return 'music';
  return 'other';
}

function formatTypeLabel(type: string, t: TranslateFn): string {
  const cat = normalizeCategory(type);
  if (cat === 'image') return t('dashboard.activity.tab.image');
  if (cat === 'video') return t('dashboard.activity.tab.video');
  if (cat === 'audio') return t('dashboard.activity.tab.audio');
  if (cat === 'music') return t('dashboard.activity.tab.music');
  return type || '—';
}

function formatJobStatus(status: string, t: TranslateFn): { label: string; className: string } {
  if (/success|finish|done|complete/i.test(status)) {
    return { label: t('dashboard.status.success'), className: 'success' };
  }
  if (/fail|error|cancel/i.test(status)) {
    return { label: t('dashboard.status.failed'), className: 'failed' };
  }
  if (/process|pending|queue|active/i.test(status)) {
    return { label: t('dashboard.status.processing'), className: 'processing' };
  }
  return { label: status || '—', className: '' };
}

function jobToRow(job: Job, t: TranslateFn): ActivityRow {
  const { label, className } = formatJobStatus(job.status, t);
  return {
    id: job.id,
    model: job.model_id || '—',
    typeLabel: formatTypeLabel(job.type, t),
    category: normalizeCategory(job.type),
    status: label,
    statusClass: className,
    cost: job.cost,
    created_at: job.created_at,
  };
}

function buildActivityRows(stats: DashboardStats, t: TranslateFn): ActivityRow[] {
  return stats.recent_jobs.map((job) => jobToRow(job, t));
}

function filterActivityRows(rows: ActivityRow[], tab: ActivityTab): ActivityRow[] {
  if (tab === 'all') return rows;
  return rows.filter((r) => r.category === tab);
}

function formatDate(iso: string, locale: AppLocale) {
  try {
    return new Date(iso).toLocaleString(dateLocale(locale), {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function BarChart({
  data,
  valueKey,
  label,
  color = 'var(--accent)',
}: {
  data: Array<Record<string, string | number>>;
  valueKey: string;
  label: string;
  color?: string;
}) {
  const max = Math.max(1, ...data.map((d) => Number(d[valueKey]) || 0));

  return (
    <div className="chart chart--fixed-cols">
      <p className="chart-title">{label}</p>
      <div className="chart-bars">
        {data.map((d, i) => {
          const val = Number(d[valueKey]) || 0;
          const h = Math.round((val / max) * 100);
          const axisLabel = String(d.date);
          return (
            <div key={`${d.date}-${i}`} className="chart-bar-wrap" title={`${axisLabel}: ${val}`}>
              <div className="chart-bar" style={{ height: `${h}%`, background: color }} />
              <span className="chart-bar-label">{axisLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { locale, t } = useLocale();
  const [period, setPeriod] = useState<DashboardPeriod>('7d');
  const [activityTab, setActivityTab] = useState<ActivityTab>('all');
  const [activityPage, setActivityPage] = useState(1);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const numberLocale = dateLocale(locale);

  const activityRows = useMemo(
    () => (stats ? buildActivityRows(stats, t) : []),
    [stats, t],
  );
  const filteredRows = useMemo(
    () => filterActivityRows(activityRows, activityTab),
    [activityRows, activityTab],
  );

  const totalActivityPages = Math.max(1, Math.ceil(filteredRows.length / ACTIVITY_PAGE_SIZE));
  const safeActivityPage = Math.min(activityPage, totalActivityPages);
  const activityStartIndex = filteredRows.length
    ? (safeActivityPage - 1) * ACTIVITY_PAGE_SIZE + 1
    : 0;
  const activityEndIndex = Math.min(safeActivityPage * ACTIVITY_PAGE_SIZE, filteredRows.length);
  const pageRows = filteredRows.slice(
    (safeActivityPage - 1) * ACTIVITY_PAGE_SIZE,
    safeActivityPage * ACTIVITY_PAGE_SIZE,
  );

  const activeTabLabel = ACTIVITY_TAB_KEYS.find((tab) => tab.id === activityTab);

  useEffect(() => {
    setActivityPage(1);
  }, [activityTab, period]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const raw = await fetchGommoDashboardStats(period);
      setStats(raw);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="page dashboard-page">
      <div className="page-head dashboard-head">
        <div>
          <p className="kicker">{t('dashboard.kicker')}</p>
          <h1>{t('dashboard.title')}</h1>
          <p className="lead">{t('dashboard.lead')}</p>
        </div>
        <div className="period-tabs">
          {PERIOD_KEYS.map((p) => (
            <button
              key={p.value}
              type="button"
              className={`tab ${period === p.value ? 'active' : ''}`}
              onClick={() => setPeriod(p.value)}
            >
              {t(p.key)}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="muted">{t('dashboard.loading')}</p>}
      {error && <p className="error">{error}</p>}

      {stats && !loading && (
        <>
          <div className="kpi-grid">
            <div className="kpi-card panel">
              <span className="kpi-label">{t('dashboard.kpi.balance')}</span>
              <span className="kpi-value">{stats.kpis.balance}</span>
            </div>
            <div className="kpi-card panel">
              <span className="kpi-label">{t('dashboard.kpi.images')}</span>
              <span className="kpi-value">{stats.kpis.images_success}</span>
              <span className="kpi-sub">{t('dashboard.kpi.successSub')}</span>
            </div>
            <div className="kpi-card panel">
              <span className="kpi-label">{t('dashboard.kpi.videos')}</span>
              <span className="kpi-value">{stats.kpis.videos_success}</span>
              <span className="kpi-sub">{t('dashboard.kpi.successSub')}</span>
            </div>
            <div className="kpi-card panel">
              <span className="kpi-label">{t('dashboard.kpi.consumed')}</span>
              <span className="kpi-value">{stats.kpis.credits_consumed_net}</span>
              <span className="kpi-sub">{t('dashboard.kpi.creditNet')}</span>
            </div>
          </div>

          <div className="dashboard-meta panel">
            <span>
              {t('dashboard.meta.jobsTotal')}: <strong>{stats.totals.jobs_total}</strong>
            </span>
            <span>
              {t('dashboard.meta.success')}:{' '}
              <strong className="ok">{stats.totals.jobs_success}</strong>
            </span>
            <span>
              {t('dashboard.meta.failed')}:{' '}
              <strong className="fail">{stats.totals.jobs_failed}</strong>
            </span>
            <span>
              {t('dashboard.meta.okRate')}: <strong>{stats.totals.success_rate}%</strong>
            </span>
            <span>
              {t('dashboard.meta.charged')}: {stats.credits.charged}
            </span>
            <span>
              {t('dashboard.meta.refunded')}: {stats.credits.refunded}
            </span>
            {(stats.credits.topped_up_total ?? 0) > 0 && (
              <span>
                {t('dashboard.meta.toppedUpAmount', {
                  amount: stats.credits.topped_up_total ?? 0,
                })}
              </span>
            )}
          </div>

          <div className="charts-grid">
            {stats.chart_bucket_days != null && (
              <p className="chart-period-hint muted">
                {t('dashboard.chart.hint', {
                  columns: MAX_CHART_COLUMNS,
                  step: formatBucketStepLabel(stats.chart_bucket_days, t),
                })}
                {period === 'all' ? ` · ${t('dashboard.chart.hintAllHistory')}` : ''}
              </p>
            )}
            <section className="panel">
              <BarChart
                data={stats.charts.jobs_by_day}
                valueKey="jobs"
                label={t('dashboard.chart.jobs')}
              />
            </section>
            <section className="panel">
              <BarChart
                data={stats.charts.jobs_by_day}
                valueKey="success"
                label={t('dashboard.chart.jobsSuccess')}
                color="var(--ok)"
              />
            </section>
            <section className="panel">
              <BarChart
                data={stats.charts.credits_by_day}
                valueKey="net"
                label={t('dashboard.chart.credits')}
                color="#e8a838"
              />
            </section>
          </div>

          <section className="panel dashboard-activity">
            <div className="panel-head">
              <h2>{t('dashboard.activity.title')}</h2>
            </div>

            <div className="period-tabs dashboard-type-tabs">
              {ACTIVITY_TAB_KEYS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`tab ${activityTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActivityTab(tab.id)}
                >
                  {t(tab.key)}
                </button>
              ))}
            </div>

            {filteredRows.length > ACTIVITY_PAGE_SIZE && (
              <div className="uh-pagination dashboard-activity-pagination">
                <span className="uh-pag-info">
                  {t('dashboard.pagination.showing', {
                    from: activityStartIndex,
                    to: activityEndIndex,
                    total: filteredRows.length.toLocaleString(numberLocale),
                  })}
                </span>
                <div className="uh-pag-btns">
                  <button
                    type="button"
                    className="uh-pag-btn"
                    disabled={safeActivityPage <= 1}
                    onClick={() => setActivityPage((p) => Math.max(1, p - 1))}
                  >
                    ‹
                  </button>
                  {Array.from({ length: totalActivityPages }, (_, i) => i + 1)
                    .filter(
                      (n) =>
                        n === 1 ||
                        n === totalActivityPages ||
                        Math.abs(n - safeActivityPage) <= 1,
                    )
                    .map((n, idx, arr) => (
                      <span key={n} className="uh-pag-seg">
                        {idx > 0 && n - arr[idx - 1] > 1 && (
                          <span className="uh-pag-ellipsis">…</span>
                        )}
                        <button
                          type="button"
                          className={`uh-pag-btn ${safeActivityPage === n ? 'active' : ''}`}
                          onClick={() => setActivityPage(n)}
                        >
                          {n}
                        </button>
                      </span>
                    ))}
                  <button
                    type="button"
                    className="uh-pag-btn"
                    disabled={safeActivityPage >= totalActivityPages}
                    onClick={() => setActivityPage((p) => Math.min(totalActivityPages, p + 1))}
                  >
                    ›
                  </button>
                </div>
              </div>
            )}

            {filteredRows.length === 0 ? (
              <p className="muted">
                {activityTab === 'all'
                  ? t('dashboard.activity.empty')
                  : t('dashboard.activity.emptyType', {
                      type: activeTabLabel ? t(activeTabLabel.key).toLowerCase() : '',
                    })}
              </p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('dashboard.table.model')}</th>
                    <th>{t('dashboard.table.type')}</th>
                    <th>{t('dashboard.table.status')}</th>
                    <th>{t('dashboard.table.credit')}</th>
                    <th>{t('dashboard.table.time')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => (
                    <tr key={row.id}>
                      <td className="mono">{row.model}</td>
                      <td>{row.typeLabel}</td>
                      <td>
                        {row.status !== '—' ? (
                          <span className={`badge ${row.statusClass}`}>{row.status}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td
                        className={
                          row.category === 'other'
                            ? row.cost != null && row.cost >= 0
                              ? 'amount-plus'
                              : row.cost != null && row.cost < 0
                                ? 'amount-minus'
                                : ''
                            : row.cost != null && row.cost > 0
                              ? 'amount-minus'
                              : ''
                        }
                      >
                        {row.cost == null || row.cost === 0
                          ? '—'
                          : row.category === 'other'
                            ? `${row.cost >= 0 ? '+' : ''}${row.cost}`
                            : `−${row.cost}`}
                      </td>
                      <td>{formatDate(row.created_at, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}
