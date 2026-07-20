import { PLATFORM_BRIDGE } from './platformBridge';

/** Qua PHP proxy gw.php → api.gommo.net (che URL). Local: Vite proxy /api/platform → pro.agi.vn. */
export const GOMO_GW = '/api/platform/gw.php';
export const GOMMO_AUTH_BASE = GOMO_GW;
export const GOMMO_AUTH_PATH = `${GOMO_GW}/api/apps/go-mmo`;

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

/** Xác thực access token — qua token-me.php (không cần JWT platform). */
export async function fetchUpstreamMe(
  accessToken: string,
  domain: string,
): Promise<UpstreamMeResponse> {
  const res = await fetch(PLATFORM_BRIDGE.tokenMe, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      access_token: accessToken.trim(),
      domain: domain.trim(),
    }),
  });

  const text = await res.text();
  let wrapper: {
    success?: boolean;
    message?: string;
    data?: UpstreamMeResponse;
  };
  try {
    wrapper = JSON.parse(text) as typeof wrapper;
  } catch {
    const isHtml = /^\s*</.test(text) || /<!doctype/i.test(text);
    throw new UpstreamMeError(
      isHtml
        ? 'API token-me chưa sẵn sàng (404). Restart npm run dev, hoặc upload token-me.php lên VPS.'
        : text.slice(0, 200) || `HTTP ${res.status}`,
      res.status,
    );
  }

  if (!res.ok || wrapper.success === false || !wrapper.data) {
    throw new UpstreamMeError(wrapper.message || `HTTP ${res.status}`, res.status);
  }

  const parsed = wrapper.data;
  if (!parsed.userInfo?.id_base && !parsed.userInfo?.email) {
    throw new UpstreamMeError('Token hợp lệ nhưng thiếu userInfo');
  }

  return parsed;
}
