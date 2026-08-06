import { loadAuth } from './authStore';
import { GOMMO_CHAT_CONFIG, WORKFLOW_CHAT_AGENT_ID } from './gommoChatConfig';
import { DEFAULT_DOMAIN } from './settingsStore';

const BASE = '/api/platform/gw.php/api/v2';

export const MOONIX_TEMPLATE_PROMPT_KEY = 'moonix_template_prompt_v1';

export type MoonixLocale = 'vi' | 'en';

export interface MoonixI18nText {
  vi?: string;
  en?: string;
}

export interface MoonixHomeFeature {
  title?: string;
  description?: string;
}

export interface MoonixHome {
  eyebrow?: string;
  title?: string;
  description?: string;
  primary_action?: string;
  secondary_action?: string;
  features?: MoonixHomeFeature[];
}

export interface MoonixChangelog {
  id?: string;
  version?: string;
  date?: string;
  type?: string;
  title?: string;
  description?: string;
  news_ids?: string[];
  guide_ids?: string[];
}

export interface MoonixGuideBlock {
  type?: string;
  text?: string;
  items?: string[];
}

export interface MoonixGuide {
  slug?: string;
  category?: string;
  title?: string;
  summary?: string;
  read_time?: string;
  blocks?: MoonixGuideBlock[];
}

export interface MoonixSuggestionCategory {
  key?: string;
  name?: MoonixI18nText;
}

export interface MoonixSuggestion {
  id: string;
  key?: string;
  suggest?: string;
  version?: number;
  category?: MoonixSuggestionCategory;
  name?: MoonixI18nText;
  description?: MoonixI18nText;
  features?: { vi?: string[]; en?: string[] };
  sdks?: string[];
  languages?: string[];
  locales?: string[];
  themes?: string[];
  auth_required?: boolean;
  complexity?: string;
  ui_layout?: string;
  preview_images?: string[];
  about_md?: MoonixI18nText;
  prompt?: MoonixI18nText;
  tags?: string[];
}

export interface MoonixContentVersion {
  version?: string;
  released_at?: string;
  product?: string;
  updated_time?: number;
}

export interface MoonixContent {
  home?: MoonixHome;
  changelogs?: MoonixChangelog[];
  guides?: MoonixGuide[];
  suggestions?: MoonixSuggestion[];
  version?: MoonixContentVersion;
}

export interface BrandDesignItem {
  id_base?: string;
  name?: string;
  slug?: string;
  avatar_url?: string;
  banner_url?: string;
  palette?: Record<string, string>;
  fonts?: string[];
  updated_time?: number;
}

/** MCP connection requirement từ POST /api/v2/mcp (action=connection_requirements). */
export interface McpConnectionRequirement {
  id?: string;
  key?: string;
  name?: string;
  title?: string;
  description?: string;
  required?: boolean;
  type?: string;
  url?: string;
  docs_url?: string;
}

export interface McpConnectionRequirementsResult {
  agent_id: string;
  requirements: McpConnectionRequirement[];
}

function deviceInfoJson(): string {
  try {
    const ua = navigator.userAgent;
    const lang = navigator.language || 'vi';
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh';
    let browserVersion = '';
    const chrome = ua.match(/Chrome\/([\d.]+)/);
    if (chrome) browserVersion = chrome[1];

    return JSON.stringify({
      device_id: GOMMO_CHAT_CONFIG.deviceId,
      device_name: GOMMO_CHAT_CONFIG.deviceName,
      device_type: 'desktop',
      platform: navigator.platform || 'Win32',
      browser_name: 'Chrome',
      browser_version: browserVersion,
      os_name: navigator.platform?.includes('Win') ? 'Windows' : navigator.platform || 'Windows',
      os_version: '10.0',
      app_mode: 'browser',
      is_pwa: false,
      user_agent: ua,
      language: lang.split('-')[0] || 'vi',
      timezone: tz,
      screen: {
        width: window.screen.width,
        height: window.screen.height,
        pixel_ratio: window.devicePixelRatio,
        color_depth: window.screen.colorDepth,
      },
    });
  } catch {
    return '{}';
  }
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

function parseMoonixContent(data: unknown): MoonixContent {
  if (!data || typeof data !== 'object') return {};
  const obj = data as Record<string, unknown>;
  const suggestions = Array.isArray(obj.suggestions)
    ? (obj.suggestions as MoonixSuggestion[]).filter((s) => Boolean(s?.id))
    : [];
  return {
    home: obj.home as MoonixHome | undefined,
    changelogs: Array.isArray(obj.changelogs) ? (obj.changelogs as MoonixChangelog[]) : [],
    guides: Array.isArray(obj.guides) ? (obj.guides as MoonixGuide[]) : [],
    suggestions,
    version: obj.version as MoonixContentVersion | undefined,
  };
}

function hasMoonixCatalog(data: unknown): boolean {
  return (
    !!data &&
    typeof data === 'object' &&
    (Array.isArray((data as MoonixContent).suggestions) ||
      !!(data as MoonixContent).home ||
      Array.isArray((data as MoonixContent).guides))
  );
}

const MOONIX_CONTENT_ACTIONS = ['get', 'catalog', 'home'] as const;

export async function fetchMoonixContent(opts?: {
  language?: 'VI' | 'EN';
}): Promise<MoonixContent> {
  const language = opts?.language ?? 'VI';
  let lastErr: unknown;

  for (const action of MOONIX_CONTENT_ACTIONS) {
    try {
      const data = await postPlatformForm('moonix-content', { action, language });
      if (hasMoonixCatalog(data)) return parseMoonixContent(data);
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error('Không tải được moonix-content');
}

function parseMcpRequirements(data: unknown): McpConnectionRequirementsResult {
  const obj = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const agentId = String(obj.agent_id ?? WORKFLOW_CHAT_AGENT_ID);
  const raw = Array.isArray(obj.requirements) ? obj.requirements : [];
  const requirements = raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => item as McpConnectionRequirement);
  return { agent_id: agentId, requirements };
}

/** Preflight MCP — agent Code Chat cần kết nối tool ngoài không? */
export async function fetchMcpConnectionRequirements(opts?: {
  agentId?: string;
}): Promise<McpConnectionRequirementsResult> {
  const agentId = opts?.agentId ?? WORKFLOW_CHAT_AGENT_ID;
  const data = await postPlatformForm('mcp', {
    action: 'connection_requirements',
    agent_id: agentId,
  });
  return parseMcpRequirements(data);
}

export function mcpRequirementLabel(req: McpConnectionRequirement): string {
  return (req.title || req.name || req.key || req.id || 'MCP connection').trim();
}

export function mcpRequirementDescription(req: McpConnectionRequirement): string {
  return (req.description || '').trim();
}

export async function fetchBrandDesigns(opts?: {
  language?: 'VI' | 'EN';
}): Promise<BrandDesignItem[]> {
  const language = opts?.language ?? 'VI';

  try {
    const data = await postPlatformForm('brand-designs', { action: 'list', language });
    if (data && typeof data === 'object' && 'items' in data) {
      const items = (data as { items?: BrandDesignItem[] }).items;
      return items ?? [];
    }
    return [];
  } catch {
    try {
      const data = await postPlatformForm('brand-designs', { language });
      if (data && typeof data === 'object' && 'items' in data) {
        const items = (data as { items?: BrandDesignItem[] }).items;
        return items ?? [];
      }
    } catch (err) {
      throw err instanceof Error ? err : new Error('Không tải được brand-designs');
    }
    return [];
  }
}

export function moonixText(text: MoonixI18nText | undefined, locale: MoonixLocale = 'vi'): string {
  if (!text) return '';
  return (locale === 'vi' ? text.vi : text.en) || text.vi || text.en || '';
}

export function moonixSuggestionName(s: MoonixSuggestion, locale: MoonixLocale = 'vi'): string {
  return moonixText(s.name, locale) || s.key || s.id;
}

export function moonixSuggestionDescription(s: MoonixSuggestion, locale: MoonixLocale = 'vi'): string {
  return moonixText(s.description, locale);
}

export function moonixSuggestionPrompt(s: MoonixSuggestion, locale: MoonixLocale = 'vi'): string {
  return moonixText(s.prompt, locale).trim();
}

export function moonixSuggestionAbout(s: MoonixSuggestion, locale: MoonixLocale = 'vi'): string {
  return moonixText(s.about_md, locale).trim();
}

export function moonixSuggestionFeatures(s: MoonixSuggestion, locale: MoonixLocale = 'vi'): string[] {
  const bucket = s.features?.[locale] ?? s.features?.vi ?? s.features?.en;
  return bucket ?? [];
}

export function moonixSuggestionCategory(s: MoonixSuggestion, locale: MoonixLocale = 'vi'): string {
  return moonixText(s.category?.name, locale) || s.category?.key || 'Khác';
}

export function moonixSuggestionPreview(s: MoonixSuggestion): string {
  return (s.preview_images ?? []).find(Boolean) ?? '';
}

export function filterMoonixSuggestions(
  items: MoonixSuggestion[],
  opts: { category?: string; query?: string; locale?: MoonixLocale },
): MoonixSuggestion[] {
  const locale = opts.locale ?? 'vi';
  const q = opts.query?.trim().toLowerCase() ?? '';
  return items.filter((s) => {
    if (opts.category && opts.category !== 'all' && s.category?.key !== opts.category) return false;
    if (!q) return true;
    const hay = [
      moonixSuggestionName(s, locale),
      moonixSuggestionDescription(s, locale),
      s.key,
      s.id,
      ...(s.tags ?? []),
      s.ui_layout,
      ...(s.sdks ?? []),
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}

export function moonixSuggestionCategories(items: MoonixSuggestion[]): { key: string; label: string }[] {
  const map = new Map<string, string>();
  for (const s of items) {
    const key = s.category?.key || 'other';
    if (!map.has(key)) map.set(key, moonixSuggestionCategory(s));
  }
  return [{ key: 'all', label: 'Tất cả' }, ...Array.from(map.entries()).map(([key, label]) => ({ key, label }))];
}

/** Lưu prompt template và mở /chat?create=mini_app */
export function stashMoonixTemplatePrompt(prompt: string): void {
  try {
    sessionStorage.setItem(MOONIX_TEMPLATE_PROMPT_KEY, prompt);
  } catch {
    // bỏ qua quota/private mode
  }
}
