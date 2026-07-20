/** localStorage — chỉ dùng demo / nội bộ (rủi ro XSS). */
const KEYS = {
  token: 'gommo_access_token',
  domain: 'gommo_domain',
  projectId: 'gommo_project_id',
} as const;

/** Project chat Moon Agent (không dùng cho media job). */
const CHAT_PROJECT_ID = '55004151b482b646';

/** Domain Gommo cho login, gen media, feed, me… */
export const DEFAULT_DOMAIN = 'vmedia.ai';
/** Domain Gommo cho plans + create_payment (cùng DEFAULT_DOMAIN) */
export const PRICING_DOMAIN = DEFAULT_DOMAIN;
/** URL site public (Vercel) */
export const APP_SITE_URL = 'https://trungtamai.vn';
export const DEFAULT_PROJECT_ID = 'default';

const LEGACY_DOMAINS = new Set([
  '79ai.net',
  'www.79ai.net',
  '79ai.com',
  'www.79ai.com',
  'www.vmedia.ai',
  'trungtamai.vn',
  'www.trungtamai.vn',
]);

/** Chuẩn hóa domain cũ (79ai, trungtamai…) → vmedia.ai. */
export function normalizeDomain(domain?: string | null): string {
  const trimmed = (domain || '').trim();
  if (!trimmed) return DEFAULT_DOMAIN;
  const lower = trimmed.toLowerCase().replace(/^www\./, '');
  if (lower === 'vmedia.ai') return DEFAULT_DOMAIN;
  if (LEGACY_DOMAINS.has(lower) || lower.endsWith('.79ai.net')) return DEFAULT_DOMAIN;
  return trimmed;
}

export interface GommoSettings {
  accessToken: string;
  domain: string;
  projectId: string;
}

export function loadSettings(): GommoSettings {
  const domain = normalizeDomain(localStorage.getItem(KEYS.domain) || DEFAULT_DOMAIN);
  if (localStorage.getItem(KEYS.domain) !== domain) {
    localStorage.setItem(KEYS.domain, domain);
  }
  let projectId = localStorage.getItem(KEYS.projectId) || DEFAULT_PROJECT_ID;
  if (projectId === CHAT_PROJECT_ID) {
    projectId = DEFAULT_PROJECT_ID;
    localStorage.setItem(KEYS.projectId, projectId);
  }
  return {
    accessToken: localStorage.getItem(KEYS.token) || '',
    domain,
    projectId,
  };
}

export function saveSettings(partial: Partial<GommoSettings>): void {
  if (partial.accessToken != null) {
    const token = partial.accessToken.trim();
    if (token) localStorage.setItem(KEYS.token, token);
    else localStorage.removeItem(KEYS.token);
  }
  if (partial.domain != null) {
    localStorage.setItem(KEYS.domain, normalizeDomain(partial.domain) || DEFAULT_DOMAIN);
  }
  if (partial.projectId != null) {
    localStorage.setItem(KEYS.projectId, partial.projectId || DEFAULT_PROJECT_ID);
  }
}
