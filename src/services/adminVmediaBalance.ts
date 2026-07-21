import { loadAuth } from './authStore';
import { PLATFORM_BRIDGE } from './platformBridge';

export interface AdminVmediaBalance {
  credits_ai: number;
  domain: string;
  updated_time: number | null;
}

/** Số dư credits_ai thật trên VMedia — chỉ admin, token merchant giữ server-side. */
export async function fetchAdminVmediaBalance(): Promise<AdminVmediaBalance | null> {
  const auth = loadAuth();
  if (!auth?.user?.isAdmin || !auth.platform_token?.trim()) {
    return null;
  }

  const res = await fetch(PLATFORM_BRIDGE.adminVmediaBalance, {
    headers: {
      Authorization: `Bearer ${auth.platform_token.trim()}`,
      Accept: 'application/json',
    },
  });

  const text = await res.text();
  let parsed: {
    success?: boolean;
    message?: string;
    data?: AdminVmediaBalance;
  };
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    throw new Error(text.slice(0, 200) || `HTTP ${res.status}`);
  }

  if (!res.ok || !parsed.success || !parsed.data) {
    throw new Error(parsed.message || `HTTP ${res.status}`);
  }

  return parsed.data;
}
