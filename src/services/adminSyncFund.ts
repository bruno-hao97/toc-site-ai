import {
  loadAuth,
  loginWithPlatformSession,
  notifyCreditsUpdated,
  refreshSession,
} from './authStore';
import { PLATFORM_BRIDGE } from './platformBridge';

export interface AdminSyncFundResult {
  message: string;
  vmedia_credits: number;
  users_credits: number;
  platform_credits_before: number;
  platform_credits: number;
  sum_platform_credits: number;
  reconcile_delta: number;
  delta_applied: number;
}

/** Đồng bộ ví nội bộ admin = VMedia − Σ credit user khác. */
export async function syncAdminInternalFund(): Promise<AdminSyncFundResult> {
  const auth = loadAuth();
  if (!auth?.user?.isAdmin || !auth.platform_token?.trim()) {
    throw new Error('Chỉ admin được đồng bộ quỹ');
  }

  const res = await fetch(PLATFORM_BRIDGE.adminSyncFund, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${auth.platform_token.trim()}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ confirm: true }),
  });

  const text = await res.text();
  let parsed: {
    success?: boolean;
    message?: string;
    data?: AdminSyncFundResult;
  };
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    throw new Error(text.slice(0, 200) || `HTTP ${res.status}`);
  }

  if (!res.ok || !parsed.success || !parsed.data) {
    throw new Error(parsed.message || `HTTP ${res.status}`);
  }

  try {
    const session = await refreshSession();
    if (session.platform_token && session.user) {
      await loginWithPlatformSession(session.platform_token, session.user);
    }
  } catch {
    /* UI vẫn refresh số từ API sync */
  }
  notifyCreditsUpdated();

  return {
    message: String(parsed.data.message || 'Đã đồng bộ quỹ'),
    vmedia_credits: Number(parsed.data.vmedia_credits ?? 0),
    users_credits: Number(parsed.data.users_credits ?? 0),
    platform_credits_before: Number(parsed.data.platform_credits_before ?? 0),
    platform_credits: Number(parsed.data.platform_credits ?? 0),
    sum_platform_credits: Number(parsed.data.sum_platform_credits ?? 0),
    reconcile_delta: Number(parsed.data.reconcile_delta ?? 0),
    delta_applied: Number(parsed.data.delta_applied ?? 0),
  };
}
