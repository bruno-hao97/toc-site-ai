import { GommoClient } from './api';
import { fetchUpstreamMe, type UpstreamMeResponse } from './upstreamMe';
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
  /** Legacy / linked Gommo access (token login or future provider link). */
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
  return trimmed;
}

/** project_id thật — tránh gửi `default` lên Gommo audio API. */
export function resolveProjectId(override?: string): string {
  return (
    pickProjectId(override) ||
    pickProjectId(loadAuth()?.projectId) ||
    pickProjectId(loadSettings().projectId) ||
    pickProjectId(GOMMO_CHAT_CONFIG.projectId) ||
    DEFAULT_PROJECT_ID
  );
}

export function loadAuth(): AuthState | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const state = JSON.parse(raw) as AuthState;
    if (state.domain) {
      const domain = normalizeDomain(state.domain);
      if (domain !== state.domain) {
        state.domain = domain;
        saveAuth(state);
      }
    }
    return state;
  } catch {
    return null;
  }
}

export function saveAuth(state: AuthState): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(state));
  saveSettings({
    accessToken: state.access_token || '',
    domain: state.domain || loadSettings().domain,
    projectId: state.projectId,
  });
}

export function clearAuth(): void {
  localStorage.removeItem(SESSION_KEY);
  saveSettings({ accessToken: '' });
}

export function isLoggedIn(): boolean {
  const auth = loadAuth();
  return Boolean(auth?.platform_token?.trim() || auth?.access_token?.trim());
}

/** Khóa localStorage theo user platform hoặc Gommo. */
export function authUserKey(): string {
  const auth = loadAuth();
  const id =
    auth?.user?.id ||
    auth?.upstream_me?.userInfo?.id_base ||
    auth?.upstream_me?.userInfo?.email ||
    auth?.user?.email;
  return id || 'anon';
}

export function getGommoClient(): GommoClient {
  const auth = loadAuth();
  if (!auth?.access_token) {
    throw new Error('Chưa liên kết nhà cung cấp AI — đăng nhập Token hoặc gắn VMedia sau');
  }
  return new GommoClient({
    accessToken: auth.access_token,
    domain: auth.domain || '',
    projectId: auth.projectId,
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
  const u = auth?.upstream_me?.userInfo;
  if (u) {
    return {
      name: u.name?.trim() || u.username?.trim() || null,
      email: u.email?.trim() || '',
      avatar: u.avatar || null,
      username: u.username || null,
    };
  }
  return { name: null, email: '', avatar: null, username: null };
}

export function getCreditsAi(): number {
  const auth = loadAuth();
  if (typeof auth?.user?.credits === 'number') return auth.user.credits;
  return auth?.upstream_me?.balancesInfo?.credits_ai ?? 0;
}

/** Thông báo số dư credit vừa thay đổi (vd sau khi tạo job) để header tự refresh. */
export function notifyCreditsUpdated(): void {
  document.dispatchEvent(new CustomEvent('credits:updated'));
}

export function getUpstreamMe(): UpstreamMeResponse | null {
  return loadAuth()?.upstream_me ?? null;
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

export async function loginWithGommoToken(
  accessToken: string,
  domain: string,
): Promise<AuthState> {
  const upstream_me = await fetchUpstreamMe(accessToken, normalizeDomain(domain));
  const prev = loadAuth();
  const state: AuthState = {
    platform_token: prev?.platform_token,
    user: prev?.user,
    access_token: accessToken.trim(),
    domain: normalizeDomain(domain),
    projectId: resolveProjectId(loadSettings().projectId),
    upstream_me,
  };
  saveAuth(state);
  return state;
}

export async function refreshSession(): Promise<AuthState> {
  const auth = loadAuth();
  if (!auth) throw new Error('Chưa đăng nhập');

  if (auth.platform_token) {
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

  if (!auth.access_token || !auth.domain) throw new Error('Chưa đăng nhập');
  const upstream_me = await fetchUpstreamMe(auth.access_token, auth.domain);
  const next = { ...auth, upstream_me };
  saveAuth(next);
  return next;
}

export function getToken(): string | null {
  const auth = loadAuth();
  return auth?.platform_token || auth?.access_token || null;
}
