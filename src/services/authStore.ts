import { GommoClient } from './api';
import type { UpstreamMeResponse } from './upstreamMe';
import { GOMMO_CHAT_CONFIG } from './gommoChatConfig';
import { PLATFORM_BRIDGE } from './platformBridge';
import { loadSettings, normalizeDomain, saveSettings } from './settingsStore';

const SESSION_KEY = 'gommo_session';
export const DEFAULT_PROJECT_ID = 'default';

export interface PlatformUser {
  id: string;
  email: string;
  phone: string | null;
  name: string | null;
  credits: number;
  isAdmin?: boolean;
  createdAt?: string;
}

export interface AuthState {
  /** JWT session owned by our platform (MySQL users). */
  platform_token?: string;
  user?: PlatformUser;
  /** Legacy only; load/save luôn xóa để client không thể chọn token Gommo khác. */
  access_token?: string;
  domain?: string;
  projectId: string;
  upstream_me?: UpstreamMeResponse;
}

export interface DisplayUser {
  name: string | null;
  email: string;
  avatar: string | null;
  username: string | null;
}

function pickProjectId(id?: string | null): string | null {
  const trimmed = id?.trim();
  if (!trimmed || trimmed === DEFAULT_PROJECT_ID) return null;
  // Project chat Moon Agent — không dùng cho job ảnh/video/library.
  if (trimmed === GOMMO_CHAT_CONFIG.projectId) return null;
  return trimmed;
}

/** project_id media — không fallback sang project chat (tránh job chỉ thấy trên white-label). */
export function resolveProjectId(override?: string): string {
  return (
    pickProjectId(override) ||
    pickProjectId(loadAuth()?.projectId) ||
    pickProjectId(loadSettings().projectId) ||
    DEFAULT_PROJECT_ID
  );
}

export function loadAuth(): AuthState | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const state = JSON.parse(raw) as AuthState;
    let dirty = false;
    if (state.access_token || state.upstream_me) {
      delete state.access_token;
      delete state.upstream_me;
      dirty = true;
    }
    if (state.domain) {
      const domain = normalizeDomain(state.domain);
      if (domain !== state.domain) {
        state.domain = domain;
        dirty = true;
      }
    }
    // Session cũ từng dính project chat → media job lệch khỏi thư viện vmedia mặc định.
    if (state.projectId === GOMMO_CHAT_CONFIG.projectId) {
      state.projectId = DEFAULT_PROJECT_ID;
      dirty = true;
    }
    if (dirty) saveAuth(state);
    return state;
  } catch {
    return null;
  }
}

export function saveAuth(state: AuthState): void {
  const projectId = pickProjectId(state.projectId) || DEFAULT_PROJECT_ID;
  const sanitized: AuthState = {
    platform_token: state.platform_token?.trim(),
    user: state.user,
    domain: normalizeDomain(state.domain),
    projectId,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(sanitized));
  saveSettings({
    domain: sanitized.domain || loadSettings().domain,
    projectId: sanitized.projectId,
  });
}

export function clearAuth(): void {
  localStorage.removeItem(SESSION_KEY);
  loadSettings(); // đồng thời dọn token Gommo legacy
}

export function isLoggedIn(): boolean {
  return Boolean(loadAuth()?.platform_token?.trim());
}

/** Khóa localStorage theo user platform. */
export function authUserKey(): string {
  const auth = loadAuth();
  const id = auth?.user?.id || auth?.user?.email;
  return id || 'anon';
}

/**
 * Client đi qua gateway server. Giá trị bearer là JWT platform;
 * gateway thay bằng token admin trước khi gọi Gommo.
 */
export function getGommoClient(): GommoClient {
  const auth = loadAuth();
  if (!auth?.platform_token) {
    throw new Error('Chưa đăng nhập');
  }
  return new GommoClient({
    platformToken: auth.platform_token,
    domain: auth.domain || 'vmedia.ai',
    projectId: resolveProjectId(auth.projectId),
  });
}

export function getDisplayUser(): DisplayUser {
  const auth = loadAuth();
  if (auth?.user) {
    return {
      name: auth.user.name?.trim() || null,
      email: auth.user.email?.trim() || '',
      avatar: null,
      username: auth.user.email?.split('@')[0] || null,
    };
  }
  return { name: null, email: '', avatar: null, username: null };
}

export function getCreditsAi(): number {
  const auth = loadAuth();
  if (typeof auth?.user?.credits === 'number') return auth.user.credits;
  return 0;
}

/** Thông báo số dư credit vừa thay đổi (vd sau khi tạo job) để header tự refresh. */
export function notifyCreditsUpdated(): void {
  document.dispatchEvent(new CustomEvent('credits:updated'));
}

export function getUpstreamMe(): UpstreamMeResponse | null {
  return null;
}

export async function loginWithPlatformSession(
  token: string,
  user: PlatformUser,
): Promise<AuthState> {
  const state: AuthState = {
    platform_token: token.trim(),
    user,
    projectId: resolveProjectId(loadSettings().projectId),
  };
  saveAuth(state);
  return state;
}

export async function refreshSession(): Promise<AuthState> {
  const auth = loadAuth();
  if (!auth) throw new Error('Chưa đăng nhập');

  if (!auth.platform_token) {
    throw new Error('Chưa đăng nhập');
  }
  const res = await fetch(PLATFORM_BRIDGE.me, {
    headers: { Authorization: `Bearer ${auth.platform_token}` },
  });
  const text = await res.text();
  let parsed: { success?: boolean; message?: string; data?: { user: PlatformUser } };
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    throw new Error(text || `HTTP ${res.status}`);
  }
  if (!res.ok || !parsed.success || !parsed.data?.user) {
    throw new Error(parsed.message || 'Không làm mới được phiên đăng nhập');
  }
  const next = { ...auth, user: parsed.data.user };
  saveAuth(next);
  return next;
}

export function getToken(): string | null {
  return loadAuth()?.platform_token || null;
}
