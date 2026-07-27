import { config } from '../config.js';
import {
  GOMMO_MIN_REMAINING_AFTER_SEND,
  MerchantBalanceError,
  TOPUP_BALANCE_PAUSE_MESSAGE,
} from './gommoMerchantBalance.js';

/** Platform admin: sau trừ topup còn lại phải ≥ 500.001. */
export function platformSafeRemainingThreshold(): number {
  return GOMMO_MIN_REMAINING_AFTER_SEND + 1;
}

export async function fetchAdminPlatformCredits(): Promise<number> {
  const bridge = config.auth.bridgeUrl.replace(/\/$/, '');
  const key = config.topup.bridgeServiceKey;
  if (!bridge) {
    throw new Error('AUTH_BRIDGE_URL chưa cấu hình — không đọc ví admin được');
  }
  if (!key) {
    throw new Error('BRIDGE_SERVICE_KEY / MIGRATE_KEY chưa cấu hình');
  }

  const url = `${bridge}/admin-balance.php`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ key }),
  });

  const text = await res.text();
  let parsed: {
    success?: boolean;
    message?: string;
    data?: { credits?: number };
  };
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    throw new Error(text.slice(0, 200) || `HTTP ${res.status}`);
  }
  if (!res.ok || !parsed.success) {
    throw new Error(parsed.message || `HTTP ${res.status}`);
  }

  const credits = Number(parsed.data?.credits);
  if (!Number.isFinite(credits) || credits < 0) {
    throw new Error('Admin thiếu credits trong admin-balance');
  }
  return Math.floor(credits);
}

export function assertAdminPlatformCanCover(input: {
  adminBalance: number;
  reservedCredits: number;
  creditsToSend: number;
}): void {
  const available = Math.floor(input.adminBalance) - Math.floor(input.reservedCredits);
  const send = Math.floor(input.creditsToSend);
  const minRemain = platformSafeRemainingThreshold();
  const required = send + minRemain;

  if (available >= required) return;

  const fmt = (n: number) => n.toLocaleString('vi-VN');
  const detail = `admin need≥${fmt(required)} pkg=${fmt(send)} available=${fmt(Math.max(0, available))} balance=${fmt(input.adminBalance)} reserved=${fmt(input.reservedCredits)} minRemain=${fmt(minRemain)}`;
  console.warn('[topup] admin platform balance insufficient', detail);
  throw new MerchantBalanceError(TOPUP_BALANCE_PAUSE_MESSAGE, detail);
}
