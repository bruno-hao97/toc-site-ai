import type { DashboardPeriod } from './dashboardTypes';
import type { TranslationKey } from '../i18n/types';

export const MAX_CHART_COLUMNS = 10;

export interface ChartDayRow {
  date: string;
  jobs: number;
  success: number;
  failed: number;
}

export interface ChartCreditRow {
  date: string;
  charged: number;
  refunded: number;
  net: number;
}

export interface ChartPointInput {
  tsSeconds: number;
  success: boolean;
  failed: boolean;
  credit: number;
}

interface InternalBucket {
  sortKey: number;
  label: string;
  jobs: number;
  success: number;
  failed: number;
  credit: number;
}

interface FixedRange {
  start: number;
  end: number;
  bucketSec: number;
  bucketDays: number;
}

function parseDayTs(date: string): number {
  const ms = new Date(`${date}T00:00:00`).getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

function formatRangeLabel(startSec: number, endSec: number): string {
  const fmt = (s: number) => {
    const d = new Date(s * 1000);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };
  const endLabel = endSec - startSec <= 86400 ? fmt(startSec) : fmt(Math.max(startSec, endSec - 1));
  return `${fmt(startSec)}–${endLabel}`;
}

function resolveFixedRange(period: DashboardPeriod, timestamps: number[]): FixedRange {
  const now = Math.floor(Date.now() / 1000);
  let start: number;
  let end = now;

  if (period === '7d') {
    start = now - 7 * 86400;
  } else if (period === '30d') {
    start = now - 30 * 86400;
  } else {
    const valid = timestamps.filter((t) => t > 0);
    if (valid.length === 0) {
      start = now - 30 * 86400;
    } else {
      start = Math.min(...valid);
      end = Math.max(...valid, now);
    }
  }

  const span = Math.max(end - start, 86400);
  const bucketSec = span / MAX_CHART_COLUMNS;
  const bucketDays = span / 86400 / MAX_CHART_COLUMNS;

  return { start, end, bucketSec, bucketDays };
}

function bucketIndex(ts: number, start: number, bucketSec: number): number {
  if (ts < start) return -1;
  const idx = Math.floor((ts - start) / bucketSec);
  return Math.min(MAX_CHART_COLUMNS - 1, Math.max(0, idx));
}

function createEmptyBuckets(range: FixedRange): InternalBucket[] {
  return Array.from({ length: MAX_CHART_COLUMNS }, (_, i) => {
    const bucketStart = range.start + i * range.bucketSec;
    const bucketEnd = i === MAX_CHART_COLUMNS - 1 ? range.end : range.start + (i + 1) * range.bucketSec;
    return {
      sortKey: i,
      label: formatRangeLabel(bucketStart, bucketEnd),
      jobs: 0,
      success: 0,
      failed: 0,
      credit: 0,
    };
  });
}

function mapToChartRows(buckets: InternalBucket[]): {
  jobs_by_day: ChartDayRow[];
  credits_by_day: ChartCreditRow[];
} {
  return {
    jobs_by_day: buckets.map((b) => ({
      date: b.label,
      jobs: b.jobs,
      success: b.success,
      failed: b.failed,
    })),
    credits_by_day: buckets.map((b) => ({
      date: b.label,
      charged: b.credit,
      refunded: 0,
      net: b.credit,
    })),
  };
}

export function buildChartBuckets(
  period: DashboardPeriod,
  points: ChartPointInput[],
): {
  jobs_by_day: ChartDayRow[];
  credits_by_day: ChartCreditRow[];
  bucket_days: number;
  column_count: number;
} {
  const timestamps = points.map((p) => p.tsSeconds);
  const range = resolveFixedRange(period, timestamps);
  const buckets = createEmptyBuckets(range);

  for (const point of points) {
    const idx = bucketIndex(point.tsSeconds, range.start, range.bucketSec);
    if (idx < 0) continue;
    buckets[idx].jobs += 1;
    if (point.success) buckets[idx].success += 1;
    if (point.failed) buckets[idx].failed += 1;
    buckets[idx].credit += point.credit;
  }

  return {
    ...mapToChartRows(buckets),
    bucket_days: range.bucketDays,
    column_count: MAX_CHART_COLUMNS,
  };
}

/** Gom lại từ chuỗi ngày (backend dashboard) vào 10 cột cố định. */
export function buildChartBucketsFromSeries(
  period: DashboardPeriod,
  jobsByDay: ChartDayRow[],
  creditsByDay: ChartCreditRow[],
): {
  jobs_by_day: ChartDayRow[];
  credits_by_day: ChartCreditRow[];
  bucket_days: number;
  column_count: number;
} {
  const timestamps = jobsByDay.map((r) => parseDayTs(r.date)).filter((t) => t > 0);
  const range = resolveFixedRange(period, timestamps);
  const buckets = createEmptyBuckets(range);

  for (const row of jobsByDay) {
    const ts = parseDayTs(row.date);
    const idx = bucketIndex(ts, range.start, range.bucketSec);
    if (idx < 0) continue;
    buckets[idx].jobs += row.jobs;
    buckets[idx].success += row.success;
    buckets[idx].failed += row.failed;
  }

  for (const row of creditsByDay) {
    const ts = parseDayTs(row.date);
    const idx = bucketIndex(ts, range.start, range.bucketSec);
    if (idx < 0) continue;
    buckets[idx].credit += row.net;
  }

  return {
    ...mapToChartRows(buckets),
    bucket_days: range.bucketDays,
    column_count: MAX_CHART_COLUMNS,
  };
}

type DashboardTranslate = (
  key: TranslationKey,
  params?: Record<string, string | number>,
) => string;

export function formatBucketStepLabel(bucketDays: number, t: DashboardTranslate): string {
  if (bucketDays >= 28) {
    return t('dashboard.chart.bucketDays', { days: Math.round(bucketDays) });
  }
  if (bucketDays >= 1) {
    const rounded = Math.round(bucketDays * 10) / 10;
    return rounded === 1
      ? t('dashboard.chart.bucketOneDay')
      : t('dashboard.chart.bucketDays', { days: rounded });
  }
  const hours = Math.round(bucketDays * 24 * 10) / 10;
  return t('dashboard.chart.bucketHours', { hours });
}
