/** Rỗng = cùng origin → request đi qua proxy server tới api.gommo.net (che URL). */
export const GOMMO_AUTH_BASE = '';
export const GOMMO_AUTH_PATH = '/api/apps/go-mmo';

export interface UpstreamUserInfo {
  id_private?: string;
  id_base?: string;
  activate?: number;
  verify_email?: number;
  name?: string;
  username?: string;
  email?: string;
  contact_phone?: string;
  avatar?: string;
  cover?: string;
  role?: string;
  partner_level_key?: string;
  domain_id?: string;
  created_time?: number;
  permissions?: Record<string, unknown>;
  partner_rate?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface UpstreamBalancesInfo {
  balance?: number;
  credits_ai?: number;
  currency?: string;
  updated_time?: number;
  [key: string]: unknown;
}

export interface UpstreamMeResponse {
  success?: boolean;
  message?: string;
  getConfig?: unknown[];
  userInfo?: UpstreamUserInfo;
  balancesInfo?: UpstreamBalancesInfo;
  videoCount?: number;
  runtime?: number;
}

export class UpstreamMeError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'UpstreamMeError';
    this.status = status;
  }
}

export async function fetchUpstreamMe(
  accessToken: string,
  domain: string,
): Promise<UpstreamMeResponse> {
  const body = new URLSearchParams({
    access_token: accessToken.trim(),
    domain: domain.trim(),
  }).toString();

  const res = await fetch(`${GOMMO_AUTH_BASE}${GOMMO_AUTH_PATH}/ai/me`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const text = await res.text();
  let parsed: UpstreamMeResponse;
  try {
    parsed = JSON.parse(text) as UpstreamMeResponse;
  } catch {
    throw new UpstreamMeError(text || `HTTP ${res.status}`, res.status);
  }

  if (!res.ok || parsed.success === false) {
    throw new UpstreamMeError(parsed.message || `HTTP ${res.status}`, res.status);
  }

  if (!parsed.userInfo?.id_base && !parsed.userInfo?.email) {
    throw new UpstreamMeError('Token hợp lệ nhưng thiếu userInfo');
  }

  return parsed;
}
