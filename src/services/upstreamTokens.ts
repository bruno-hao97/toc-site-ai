import { GOMMO_AUTH_BASE, GOMMO_AUTH_PATH, UpstreamMeError } from './upstreamMe';

export interface UpstreamTokenItem {
  name: string;
  status: string;
  token_key: string;
  expired_time: number;
  created_time: number;
  access_token: string;
}

export interface UpstreamTokenListResponse {
  success?: boolean;
  message?: string;
  data?: UpstreamTokenItem[];
  runtime?: number;
}

async function upstreamAuthPost<T>(
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

export async function fetchAllUpstreamTokens(
  accessToken: string,
  domain: string,
): Promise<UpstreamTokenListResponse> {
  return upstreamAuthPost<UpstreamTokenListResponse>('/auth/token.getAll', accessToken, domain);
}

export function formatUnixTime(ts: number): string {
  if (!ts) return '—';
  try {
    return new Date(ts * 1000).toLocaleString('vi-VN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return String(ts);
  }
}

export function maskToken(token: string): string {
  if (token.length <= 16) return token;
  return `${token.slice(0, 10)}…${token.slice(-6)}`;
}
