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

