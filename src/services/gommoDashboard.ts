import {
  fetchMyVideos,
  fetchMyImages,
  type FeedItem,
} from './feedApi';
import { getCreditsAi } from './authStore';
import type {
  CreditTransaction,
  DashboardPeriod,
  DashboardStats,
  Job,
} from './dashboardTypes';
import { buildChartBuckets } from './dashboardChartBuckets';

const PAGE_LIMIT = 50;
// Chặn vòng lặp vô hạn nếu API luôn trả nextAfterId (~2000 item mỗi loại).
const SAFETY_MAX_PAGES = 40;

type Fetcher = (params: { limit?: number; afterId?: string }) => Promise<{
  items: FeedItem[];
  nextAfterId: string;
}>;

/**
 * Lấy hết job của user theo từng trang. Dữ liệu Gommo trả về đã sắp xếp giảm dần
 * theo thời gian, nên khi trang hiện tại đã chạm mốc `cutoff` (job cũ hơn khoảng
 * đang xem) thì dừng sớm để khỏi tải thừa. `cutoff = 0` (period 'all') tải toàn bộ.
 */
async function fetchAllMine(fetcher: Fetcher, cutoff: number): Promise<FeedItem[]> {
  const all: FeedItem[] = [];
  let afterId = '';
  for (let i = 0; i < SAFETY_MAX_PAGES; i += 1) {
    const page = await fetcher({ limit: PAGE_LIMIT, afterId });
    all.push(...page.items);
    if (!page.nextAfterId || page.items.length === 0) break;
    if (cutoff > 0) {
      const oldest = page.items[page.items.length - 1];
      if (itemTime(oldest) < cutoff) break;
    }
    afterId = page.nextAfterId;
  }
  return all;
}

function itemTime(it: FeedItem): number {
  const v = it.created_time;
  const ts = typeof v === 'string' ? Number(v) : v ?? 0;
  return Number.isFinite(ts) ? Number(ts) : 0;
}

function isSuccess(status: string | undefined): boolean {
  return /finish|success|done|complete/i.test(status ?? '');
}

function isFailed(status: string | undefined): boolean {
  return /fail|error|cancel/i.test(status ?? '');
}

function periodCutoffSeconds(period: DashboardPeriod): number {
  if (period === '7d') return 7 * 86400;
  if (period === '30d') return 30 * 86400;
  return 0;
}

/**
 * Dựng thống kê dashboard từ dữ liệu Gommo thật (ảnh/video của user + số dư credit),
 * trả về cùng shape DashboardStats để tái dùng UI dashboard hiện có.
 */
export async function fetchGommoDashboardStats(
  period: DashboardPeriod = '7d',
): Promise<DashboardStats> {
  const cutoffSec = periodCutoffSeconds(period);
  const cutoff = cutoffSec > 0 ? Math.floor(Date.now() / 1000) - cutoffSec : 0;

  // Lấy toàn bộ job Gommo của user (ảnh + video) trong khoảng đang xem.
  const [videos, images] = await Promise.all([
    fetchAllMine(fetchMyVideos, cutoff),
    fetchAllMine(fetchMyImages, cutoff),
  ]);

  const all: FeedItem[] = [...videos, ...images].filter(
    (it) => itemTime(it) >= cutoff,
  );

  const videosInPeriod = all.filter((it) => it.type === 'video');
  const imagesInPeriod = all.filter((it) => it.type === 'image');

  const jobsSuccess = all.filter((it) => isSuccess(it.status)).length;
  const jobsFailed = all.filter((it) => isFailed(it.status)).length;
  const jobsTotal = all.length;
  const creditsConsumed = all.reduce((sum, it) => sum + (it.credit_fee || 0), 0);

  const chartPoints = all.map((it) => ({
    tsSeconds: itemTime(it),
    success: isSuccess(it.status),
    failed: isFailed(it.status),
    credit: it.credit_fee || 0,
  }));
  const { jobs_by_day, credits_by_day, bucket_days } = buildChartBuckets(period, chartPoints);

  const sorted = [...all].sort((a, b) => itemTime(b) - itemTime(a));

  const recentJobs: Job[] = sorted.slice(0, 50).map((it) => ({
    id: it.id_base,
    type: it.type,
    model_id: it.modelInfo?.name || it.model || '—',
    status: it.status || '—',
    result_url: it.download_url ?? it.thumbnail_url ?? null,
    cost: it.credit_fee || 0,
    error: null,
    created_at: new Date(itemTime(it) * 1000).toISOString(),
    updated_at: new Date(itemTime(it) * 1000).toISOString(),
  }));

  const recentTransactions: CreditTransaction[] = sorted
    .filter((it) => (it.credit_fee || 0) > 0)
    .slice(0, 12)
    .map((it) => ({
      id: `tx-${it.id_base}`,
      amount: -(it.credit_fee || 0),
      type: 'job_charge',
      job_id: it.id_base,
      description: `${it.type} · ${it.modelInfo?.name || it.model || ''}`.trim(),
      created_at: new Date(itemTime(it) * 1000).toISOString(),
    }));

  return {
    balance: getCreditsAi(),
    period,
    kpis: {
      balance: getCreditsAi(),
      images_success: imagesInPeriod.filter((it) => isSuccess(it.status)).length,
      videos_success: videosInPeriod.filter((it) => isSuccess(it.status)).length,
      credits_consumed_net: creditsConsumed,
    },
    totals: {
      jobs_total: jobsTotal,
      jobs_success: jobsSuccess,
      jobs_failed: jobsFailed,
      success_rate: jobsTotal ? Math.round((jobsSuccess / jobsTotal) * 100) : 0,
    },
    credits: {
      charged: creditsConsumed,
      refunded: 0,
      consumed_net: creditsConsumed,
      signup_bonus: 0,
    },
    charts: {
      jobs_by_day,
      credits_by_day,
    },
    chart_bucket_days: bucket_days,
    chart_column_count: 10,
    recent_jobs: recentJobs,
    recent_transactions: recentTransactions,
  };
}
