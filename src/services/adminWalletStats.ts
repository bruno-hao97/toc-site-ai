import { loadAuth } from './authStore';
import { PLATFORM_BRIDGE } from './platformBridge';

export interface AdminWalletTransferRow {
  id: string;
  amount: number;
  kind: string;
  message: string | null;
  created_at: string;
  to_email: string | null;
  to_name: string | null;
}

export interface AdminWalletStats {
  platform_credits: number;
  users_credits: number;
  sum_platform_credits: number;
  vmedia_credits: number | null;
  vmedia_updated_time: number | null;
  reconcile_delta: number | null;
  reconcile_ok: boolean | null;
  reconcile_threshold: number;
  transferred_to_users: number;
  transferred_grant: number;
  transferred_transfer: number;
  transferred_topup: number;
  self_used: number;
  in_flight_admin: number;
  in_flight_all: number;
  consumed_all: number;
  refunded_total: number;
  implied_admin_fund: number;
  recent_transfers: AdminWalletTransferRow[];
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Thống kê 2 ví admin + đối soát VMedia ↔ Σ platform. */
export async function fetchAdminWalletStats(): Promise<AdminWalletStats | null> {
  const auth = loadAuth();
  if (!auth?.user?.isAdmin || !auth.platform_token?.trim()) {
    return null;
  }

  const res = await fetch(PLATFORM_BRIDGE.adminWalletStats, {
    headers: {
      Authorization: `Bearer ${auth.platform_token.trim()}`,
      Accept: 'application/json',
    },
  });

  const text = await res.text();
  let parsed: {
    success?: boolean;
    message?: string;
    data?: Partial<AdminWalletStats>;
  };
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    throw new Error(text.slice(0, 200) || `HTTP ${res.status}`);
  }

  if (!res.ok || !parsed.success || !parsed.data) {
    throw new Error(parsed.message || `HTTP ${res.status}`);
  }

  const d = parsed.data;
  return {
    platform_credits: num(d.platform_credits),
    users_credits: num(d.users_credits),
    sum_platform_credits: num(d.sum_platform_credits),
    vmedia_credits: d.vmedia_credits == null ? null : num(d.vmedia_credits),
    vmedia_updated_time: d.vmedia_updated_time == null ? null : num(d.vmedia_updated_time),
    reconcile_delta: d.reconcile_delta == null ? null : num(d.reconcile_delta),
    reconcile_ok: d.reconcile_ok == null ? null : Boolean(d.reconcile_ok),
    reconcile_threshold: num(d.reconcile_threshold, 1000),
    transferred_to_users: num(d.transferred_to_users),
    transferred_grant: num(d.transferred_grant),
    transferred_transfer: num(d.transferred_transfer),
    transferred_topup: num(d.transferred_topup),
    self_used: num(d.self_used),
    in_flight_admin: num(d.in_flight_admin),
    in_flight_all: num(d.in_flight_all),
    consumed_all: num(d.consumed_all),
    refunded_total: num(d.refunded_total),
    implied_admin_fund: num(d.implied_admin_fund),
    recent_transfers: Array.isArray(d.recent_transfers) ? d.recent_transfers : [],
  };
}
