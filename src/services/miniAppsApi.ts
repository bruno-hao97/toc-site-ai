import { loadAuth } from './authStore';
import { GOMMO_CHAT_CONFIG } from './gommoChatConfig';
import { DEFAULT_DOMAIN } from './settingsStore';

const BASE = '/api/platform/gw.php/api/v2';

export interface MiniAppAuthor {
  username?: string;
  name?: string;
  avatar?: string;
}

export interface MiniAppReview {
  id?: string;
  rating?: number;
  score?: number;
  reason?: string;
  comment?: string;
  content?: string;
  message?: string;
  user?: MiniAppAuthor;
  authorInfo?: MiniAppAuthor;
  created_at?: string;
  created_time?: string | number;
}

export interface MiniAppVotesSummary {
  rating_avg?: number;
  rating_count?: number;
  score?: number;
  total?: number;
  stars?: Record<string, number>;
}

export interface MiniAppVotesResult {
  summary: MiniAppVotesSummary;
  items: MiniAppReview[];
}

export interface MiniAppSummary {
  price_credit?: number;
  is_free?: boolean;
  usage_count?: number;
  marketplace_score?: number;
  votes?: {
    rating_avg?: number;
    rating_count?: number;
    items?: MiniAppReview[];
    list?: MiniAppReview[];
  };
}

export interface MiniAppModeration {
  status?: string;
  reason?: string;
}

export interface MiniAppItem {
  id_base: string;
  name: string;
  slug: string;
  description: string;
  avatar_url?: string;
  banner_url?: string;
  tags?: string[];
  privacy?: string;
  status?: string;
  is_free?: string | boolean;
  price_credit?: string | number;
  billing_period?: string;
  rating_avg?: string | number;
  rating_count?: string | number;
  marketplace_score?: string | number;
  usage_count?: string | number;
  weekly_use_count?: string | number;
  weekly_view_count?: string | number;
  is_owner?: boolean;
  is_purchased?: boolean;
  authorInfo?: MiniAppAuthor;
  summary?: MiniAppSummary;
  moderation?: MiniAppModeration;
  gallery?: string[];
  detail_description?: string;
  long_description?: string;
  reviews?: MiniAppReview[];
  rating_list?: MiniAppReview[];
  votes_list?: MiniAppReview[];
  entitlement?: {
    is_purchased?: boolean;
    is_owner?: boolean;
  };
}

export type MiniAppDetail = MiniAppItem;

export type MarketTab =
  | 'public'
  | 'mine'
  | 'fun'
  | 'entertainment'
  | 'graphics'
  | 'saved'
  | 'approved';

export interface MarketFilters {
  freeOnly: boolean;
  paidOnly: boolean;
  ratedOnly: boolean;
}

export const DEFAULT_MARKET_FILTERS: MarketFilters = {
  freeOnly: false,
  paidOnly: false,
  ratedOnly: false,
};

export function countActiveMarketFilters(filters: MarketFilters): number {
  return Number(filters.freeOnly) + Number(filters.paidOnly) + Number(filters.ratedOnly);
}

function tagMatches(app: MiniAppItem, patterns: RegExp[]): boolean {
  const tags = app.tags ?? [];
  return tags.some((tag) => patterns.some((p) => p.test(tag)));
}

export function filterMiniAppsByTab(items: MiniAppItem[], tab: MarketTab): MiniAppItem[] {
  switch (tab) {
    case 'mine':
      return items.filter((a) => a.is_owner || a.entitlement?.is_owner);
    case 'fun':
      return items.filter((a) =>
        tagMatches(a, [/game/i, /fun/i, /fantasy/i, /spooky/i, /puzzle/i, /quiz/i, /kids/i]),
      );
    case 'entertainment':
      return items.filter((a) =>
        tagMatches(a, [/video/i, /music/i, /mv/i, /tiktok/i, /reels/i, /storyboard/i, /film/i, /audio/i]),
      );
    case 'graphics':
      return items.filter((a) =>
        tagMatches(a, [/design/i, /branding/i, /logo/i, /image/i, /art/i, /thumbnail/i, /banner/i, /photo/i]),
      );
    case 'saved':
      return [];
    case 'approved':
      return items.filter((a) => a.moderation?.status === 'APPROVED');
    default:
      return items.filter((a) => (a.privacy ?? 'PUBLIC') === 'PUBLIC' && (a.status ?? 'LIVE') === 'LIVE');
  }
}

export function applyMarketFilters(items: MiniAppItem[], filters: MarketFilters): MiniAppItem[] {
  return items.filter((app) => {
    const free = isMiniAppFree(app);
    if (filters.freeOnly && !free) return false;
    if (filters.paidOnly && free) return false;
    if (filters.ratedOnly && miniAppRating(app) <= 0) return false;
    return true;
  });
}

function deviceInfoJson(): string {
  try {
    return JSON.stringify({
      browser_name: 'Chrome',
      os_name: navigator.platform || 'Windows',
      screen: { width: window.screen.width, height: window.screen.height },
    });
  } catch {
    return '{}';
  }
}

export function isMiniAppFree(app: MiniAppItem): boolean {
  if (app.summary?.is_free != null) return app.summary.is_free;
  return app.is_free === '1' || app.is_free === true;
}

export function miniAppRating(app: MiniAppItem): number {
  const fromSummary = app.summary?.votes?.rating_avg;
  if (fromSummary != null && fromSummary > 0) return fromSummary;
  const raw = app.rating_avg;
  const n = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function miniAppThumb(app: MiniAppItem): string {
  return (app.avatar_url || app.banner_url || '').trim();
}

/** Hiển thị giá mini app (credits_ai). */
export function formatMiniAppPrice(app: MiniAppItem): string {
  if (isMiniAppFree(app)) return 'Miễn phí';
  const credit = app.summary?.price_credit ?? Number(app.price_credit ?? 0);
  const period = app.billing_period || 'lifetime';
  const periodLabel =
    period === 'lifetime'
      ? 'vĩnh viễn'
      : period === '7d'
        ? 'tuần'
        : period === '30d'
          ? '30 ngày'
          : period === '90d'
            ? '90 ngày'
            : period;
  if (credit >= 1000) return `${Math.round(credit / 1000)}k / ${periodLabel}`;
  return `${credit.toLocaleString('vi-VN')} / ${periodLabel}`;
}

export function miniAppScore(app: MiniAppItem): number {
  const raw = app.summary?.marketplace_score ?? app.marketplace_score;
  const n = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function miniAppUsageCount(app: MiniAppItem): number {
  const raw = app.summary?.usage_count ?? app.usage_count;
  const n = typeof raw === 'string' ? parseInt(raw, 10) : Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function miniAppRatingCount(app: MiniAppItem): number {
  const fromSummary = app.summary?.votes?.rating_count;
  if (fromSummary != null) return fromSummary;
  const raw = app.rating_count;
  const n = typeof raw === 'string' ? parseInt(raw, 10) : Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function resolveMiniAppPayload(app: Pick<MiniAppItem, 'id_base'>) {
  return {
    id_base: app.id_base,
    mini_app_id: app.id_base,
  };
}

export function miniAppPreviewImages(app: MiniAppItem): string[] {
  const gallery = (app.gallery ?? []).filter(Boolean);
  if (gallery.length) return gallery;
  return [app.banner_url, app.avatar_url].filter((u): u is string => Boolean(u?.trim()));
}

export function miniAppLongDescription(app: MiniAppItem): string {
  return (app.long_description || app.detail_description || app.description || '').trim();
}

function normalizeMiniAppReview(raw: unknown): MiniAppReview | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const ratingRaw = item.rating ?? item.score ?? item.star ?? item.stars;
  const rating = typeof ratingRaw === 'string' ? parseFloat(ratingRaw) : Number(ratingRaw);
  const reason = String(
    item.reason ?? item.comment ?? item.content ?? item.message ?? item.text ?? '',
  ).trim();
  const user = (item.user ?? item.authorInfo ?? item.author) as MiniAppAuthor | undefined;
  if (!reason && !(Number.isFinite(rating) && rating > 0)) return null;

  const idRaw = item.id_base ?? item.id;
  const createdTime = item.created_time;

  return {
    id: typeof idRaw === 'string' ? idRaw : undefined,
    rating: Number.isFinite(rating) ? rating : undefined,
    reason: reason || undefined,
    comment: reason || undefined,
    user,
    authorInfo: user,
    created_at: typeof item.created_at === 'string' ? item.created_at : undefined,
    created_time:
      typeof createdTime === 'string' || typeof createdTime === 'number'
        ? createdTime
        : undefined,
  };
}

export function miniAppReviews(app: MiniAppItem): MiniAppReview[] {
  const buckets: unknown[] = [
    app.reviews,
    app.rating_list,
    app.votes_list,
    app.summary?.votes?.items,
    app.summary?.votes?.list,
  ];

  const seen = new Set<string>();
  const out: MiniAppReview[] = [];

  for (const bucket of buckets) {
    if (!Array.isArray(bucket)) continue;
    for (const raw of bucket) {
      const review = normalizeMiniAppReview(raw);
      if (!review) continue;
      const key = review.id || `${review.user?.username ?? review.authorInfo?.name ?? 'anon'}-${review.comment ?? ''}-${review.rating ?? 0}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(review);
    }
  }

  return out;
}

export function miniAppReviewAuthor(review: MiniAppReview): string {
  return (
    review.authorInfo?.name ||
    review.user?.name ||
    review.authorInfo?.username ||
    review.user?.username ||
    'Ẩn danh'
  );
}

export function miniAppReviewAvatar(review: MiniAppReview): string {
  return (review.authorInfo?.avatar || review.user?.avatar || '').trim();
}

export function miniAppReviewComment(review: MiniAppReview): string {
  return (review.reason || review.comment || review.content || review.message || '').trim();
}

function toNum(raw: unknown): number {
  const n = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function toInt(raw: unknown): number {
  const n = typeof raw === 'string' ? parseInt(raw, 10) : Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function parseMiniAppVotesResponse(data: unknown): MiniAppVotesResult {
  let obj: Record<string, unknown> = {};
  if (data && typeof data === 'object') {
    const root = data as Record<string, unknown>;
    if (root.summary != null || Array.isArray(root.items) || Array.isArray(root.list)) {
      obj = root;
    } else if (root.data && typeof root.data === 'object') {
      obj = root.data as Record<string, unknown>;
    }
  }

  const summaryRaw =
    obj.summary && typeof obj.summary === 'object'
      ? (obj.summary as Record<string, unknown>)
      : {};

  const summary: MiniAppVotesSummary = {
    rating_avg: toNum(summaryRaw.rating_avg ?? summaryRaw.score),
    rating_count: toInt(summaryRaw.rating_count ?? summaryRaw.total),
    score: toNum(summaryRaw.score),
    total: toInt(summaryRaw.total),
    stars:
      summaryRaw.stars && typeof summaryRaw.stars === 'object'
        ? (summaryRaw.stars as Record<string, number>)
        : undefined,
  };

  const rawItems = Array.isArray(obj.items)
    ? obj.items
    : Array.isArray(obj.list)
      ? obj.list
      : [];

  const items = rawItems
    .map(normalizeMiniAppReview)
    .filter((review): review is MiniAppReview => review != null);

  return { summary, items };
}

async function postPlatformForm(endpoint: string, fields: Record<string, string>): Promise<unknown> {
  const auth = loadAuth();
  const token = auth?.platform_token?.trim() || auth?.access_token?.trim();
  if (!token) {
    throw new Error('Chưa đăng nhập');
  }

  const cfg = GOMMO_CHAT_CONFIG;
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    form.set(key, value);
  }
  form.set('domain', auth?.domain || DEFAULT_DOMAIN);
  form.set('device_id', cfg.deviceId);
  form.set('device_name', cfg.deviceName);
  form.set('device_info', deviceInfoJson());
  if (auth?.access_token?.trim()) {
    form.set('access_token', auth.access_token.trim());
  }

  const res = await fetch(`${BASE}/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  if (!res.ok) {
    throw new Error(`${endpoint} HTTP ${res.status}`);
  }

  const json = (await res.json()) as {
    success?: boolean;
    message?: string;
    data?: unknown;
  };

  if (json.success === false) {
    throw new Error(json.message ?? `Không tải được ${endpoint}`);
  }

  return json.data ?? json;
}

async function postMiniAppsForm(fields: Record<string, string>): Promise<unknown> {
  return postPlatformForm('mini-apps', fields);
}

function normalizeMiniAppDetail(data: unknown, fallback: MiniAppItem): MiniAppDetail {
  if (!data || typeof data !== 'object') return { ...fallback };
  const obj = data as Record<string, unknown>;
  const item = (obj.item ?? obj.info ?? obj) as MiniAppDetail;
  return { ...fallback, ...item };
}

export async function fetchMiniAppInfo(app: MiniAppItem): Promise<MiniAppDetail> {
  const { id_base, mini_app_id } = resolveMiniAppPayload(app);
  const data = await postMiniAppsForm({
    action: 'get',
    id_base,
    mini_app_id,
  });
  return normalizeMiniAppDetail(data, app);
}

export async function fetchMiniAppVotes(app: MiniAppItem): Promise<MiniAppVotesResult> {
  const data = await postPlatformForm('votes', {
    action: 'list',
    target_type: 'mini_app',
    target_id: app.id_base,
    limit: '50',
    language: 'VI',
  });

  return parseMiniAppVotesResponse(data);
}

export async function fetchMarketplaceMiniApps(opts?: {
  search?: string;
  language?: 'VI' | 'EN';
}): Promise<MiniAppItem[]> {
  const auth = loadAuth();
  if (!auth?.platform_token) return [];

  try {
    const data = await postMiniAppsForm({
      action: 'marketplace',
      search: opts?.search ?? '',
      language: opts?.language ?? 'VI',
    });

    const items =
      data && typeof data === 'object' && 'items' in data
        ? (data as { items?: MiniAppItem[] }).items
        : undefined;

    return items ?? [];
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

/** Mở mini app trên vmedia (runtime Gommo). */
export function openMiniAppOnVmedia(app: MiniAppItem, domain = DEFAULT_DOMAIN): void {
  const host = domain.replace(/^www\./, '');
  const url = `https://${host}/chat?mini_app=${encodeURIComponent(app.id_base)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** Mở mini app trong cùng tab (giống vmedia "Sử dụng"). */
export function openMiniAppInApp(
  app: MiniAppItem,
  navigate?: (path: string) => void,
): void {
  const path = `/chat?mini_app=${encodeURIComponent(app.id_base)}`;
  if (navigate) navigate(path);
  else window.location.assign(path);
}

/** Mở trang tạo Mini App trên vmedia. */
export function openCreateMiniAppOnVmedia(domain = DEFAULT_DOMAIN): void {
  const auth = loadAuth();
  const host = (auth?.domain || domain).replace(/^www\./, '');
  window.open(`https://${host}/chat`, '_blank', 'noopener,noreferrer');
}
