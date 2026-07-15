import { GOMMO_AUTH_BASE, GOMMO_AUTH_PATH, UpstreamMeError } from './upstreamMe';

export interface UsageHistoryItem {
  id: string;
  type: string;
  typeLabel: string;
  model?: string;
  prompt?: string;
  status: 'success' | 'failed' | 'pending';
  statusLabel: string;
  cost?: number | null;
  balanceAfter?: number | null;
  createdAt: string;
  createdTime?: number;
}

export interface UsageHistoryQuery {
  from?: string;
  to?: string;
  type?: string | null;
  page?: number;
  limit?: number;
}

async function upstreamPost<T>(
  path: string,
  accessToken: string,
  domain: string,
  extra: Record<string, string> = {},
): Promise<T> {
  const body = new URLSearchParams({
    access_token: accessToken.trim(),
    domain: domain.trim(),
    ...extra,
  }).toString();

  const res = await fetch(`${GOMMO_AUTH_BASE}${GOMMO_AUTH_PATH}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const text = await res.text();
  let parsed: T & { success?: boolean; message?: string };
  try {
    parsed = JSON.parse(text) as T & { success?: boolean; message?: string };
  } catch {
    throw new UpstreamMeError(text || `HTTP ${res.status}`, res.status);
  }

  if (!res.ok || parsed.success === false) {
    throw new UpstreamMeError(parsed.message || `HTTP ${res.status}`, res.status);
  }

  return parsed;
}

function mapTypeLabel(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('image') || t === 'ảnh') return 'Tạo ảnh';
  if (t.includes('video')) return 'Tạo video';
  if (t.includes('audio') || t.includes('tts') || t.includes('music')) return 'Tạo audio';
  if (t.includes('avatar')) return 'Tạo avatar';
  return type || 'Hoạt động';
}

function normalizeRow(raw: Record<string, unknown>, index: number): UsageHistoryItem {
  const type = String(raw.type || raw.job_type || raw.category || 'unknown');
  const statusRaw = String(raw.status || raw.state || 'success').toLowerCase();
  const success = statusRaw.includes('success') || statusRaw.includes('done') || statusRaw === '1' || statusRaw === 'hoàn tất';
  const failed = statusRaw.includes('fail') || statusRaw.includes('error');

  let createdAt = '';
  if (typeof raw.created_time === 'number') {
    createdAt = new Date(raw.created_time * 1000).toISOString();
  } else if (typeof raw.created_at === 'string') {
    createdAt = raw.created_at;
  } else if (typeof raw.time === 'number') {
    createdAt = new Date(raw.time * 1000).toISOString();
  } else {
    createdAt = new Date().toISOString();
  }

  const cost = raw.cost ?? raw.amount ?? raw.credit ?? raw.charge;
  const balanceAfter = raw.balance_after ?? raw.balance ?? raw.remaining_balance;

  return {
    id: String(raw.id || raw.id_base || raw.transaction_id || `row-${index}`),
    type,
    typeLabel: String(raw.type_label || raw.title || mapTypeLabel(type)),
    model: String(raw.model || raw.model_name || raw.model_id || ''),
    prompt: String(raw.prompt || raw.description || raw.content || ''),
    status: failed ? 'failed' : success ? 'success' : 'pending',
    statusLabel: failed ? 'Thất bại' : success ? 'Hoàn tất' : 'Đang xử lý',
    cost: typeof cost === 'number' ? cost : cost != null ? Number(cost) : null,
    balanceAfter: typeof balanceAfter === 'number' ? balanceAfter : balanceAfter != null ? Number(balanceAfter) : null,
    createdAt,
    createdTime: typeof raw.created_time === 'number' ? raw.created_time : undefined,
  };
}

function extractRows(parsed: Record<string, unknown>): UsageHistoryItem[] {
  const candidates = [
    parsed.data,
    parsed.items,
    parsed.list,
    parsed.history,
    parsed.transactions,
  ];

  for (const c of candidates) {
    if (Array.isArray(c)) {
      return c.map((row, i) => normalizeRow(row as Record<string, unknown>, i));
    }
  }

  if (Array.isArray(parsed)) {
    return parsed.map((row, i) => normalizeRow(row as Record<string, unknown>, i));
  }

  return [];
}

const PATHS = [
  '/ai/usage-history',
  '/auth/usage-history.getAll',
  '/ai/paymentsHistory',
];

export async function fetchUpstreamUsageHistory(
  accessToken: string,
  domain: string,
  query: UsageHistoryQuery = {},
): Promise<{ items: UsageHistoryItem[]; source: 'upstream' | 'empty' }> {
  const extra: Record<string, string> = {};
  if (query.from) extra.from_date = query.from;
  if (query.to) extra.to_date = query.to;
  if (query.type) extra.type = query.type;
  if (query.page) extra.page = String(query.page);
  if (query.limit) extra.limit = String(query.limit);

  let lastErr: Error | null = null;

  for (const path of PATHS) {
    try {
      const parsed = await upstreamPost<Record<string, unknown>>(path, accessToken, domain, extra);
      const items = extractRows(parsed);
      if (items.length > 0) return { items, source: 'upstream' };
      if (parsed.success !== false) return { items: [], source: 'upstream' };
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
    }
  }

  if (lastErr) throw lastErr;
  return { items: [], source: 'empty' };
}

export function filterUsageByType(items: UsageHistoryItem[], tab: string | null): UsageHistoryItem[] {
  if (!tab || tab === 'all') return items;
  if (tab === 'image') return items.filter((i) => /image|ảnh/i.test(i.type) || /ảnh/i.test(i.typeLabel));
  if (tab === 'video') return items.filter((i) => /video/i.test(i.type) || /video/i.test(i.typeLabel));
  if (tab === 'audio') {
    return items.filter((i) =>
      /audio|tts|music|giọng|nhạc/i.test(i.type) ||
      /audio|giọng|nhạc/i.test(i.typeLabel),
    );
  }
  return items;
}

export function filterUsageByDate(items: UsageHistoryItem[], from?: string, to?: string): UsageHistoryItem[] {
  const fromMs = from ? new Date(`${from}T00:00:00`).getTime() : null;
  const toMs = to ? new Date(`${to}T23:59:59`).getTime() : null;
  return items.filter((item) => {
    const t = new Date(item.createdAt).getTime();
    if (fromMs != null && t < fromMs) return false;
    if (toMs != null && t > toMs) return false;
    return true;
  });
}
