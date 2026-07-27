import { config, isGommoMerchantConfigured } from '../config.js';
import { gommoServerDeviceFields } from './gommoDevice.js';

/** Gommo: sau sendBalances số dư còn lại phải > 500.000. */
export const GOMMO_MIN_REMAINING_AFTER_SEND = 500_000;

/** Khả dụng tối thiểu an toàn (= 500.001). */
export function merchantSafeAvailableThreshold(): number {
  return GOMMO_MIN_REMAINING_AFTER_SEND + 1;
}

/** Khớp src/lib/brand CONTACT_PHONE_DISPLAY. */
const SUPPORT_PHONE_DISPLAY = '097 3636 888';

export const TOPUP_BALANCE_PAUSE_MESSAGE =
  `Hệ thống đang tạm dừng nhận thanh toán để đảm bảo giao dịch ổn định. Vui lòng thử lại sau ít phút hoặc liên hệ hỗ trợ ${SUPPORT_PHONE_DISPLAY} nếu cần gấp.`;

export class MerchantBalanceError extends Error {
  detail?: string;
  constructor(message: string, detail?: string) {
    super(message);
    this.name = 'MerchantBalanceError';
    this.detail = detail;
  }
}

export async function fetchMerchantCreditsAi(): Promise<number> {
  if (!isGommoMerchantConfigured()) {
    throw new Error('Chưa cấu hình GOMMO_ACCESS_TOKEN trên server');
  }

  const body = new URLSearchParams({
    access_token: config.gommo.accessToken,
    domain: config.gommo.apiDomain,
    ...gommoServerDeviceFields(),
  }).toString();

  const url = `${config.gommo.authBaseUrl}${config.gommo.authPath}/ai/me`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const text = await res.text();
  let raw: {
    success?: boolean;
    message?: string;
    balancesInfo?: { credits_ai?: number };
  };
  try {
    raw = JSON.parse(text) as typeof raw;
  } catch {
    throw new Error(text || `Không đọc được số dư merchant (HTTP ${res.status})`);
  }

  if (!res.ok || raw.success === false) {
    throw new Error(raw.message || `Không đọc được số dư merchant (HTTP ${res.status})`);
  }

  const credits = Number(raw.balancesInfo?.credits_ai);
  if (!Number.isFinite(credits) || credits < 0) {
    throw new Error('Merchant thiếu credits_ai trong balancesInfo');
  }
  return Math.floor(credits);
}

/**
 * Cần khả dụng >= credits + buffer, và sau trừ vẫn > 500k (rule Gommo).
 * available = merchantBalance - reservedPendingCredits
 */
export function requiredMerchantCredits(creditsToSend: number, bufferCredits: number): number {
  const send = Math.floor(creditsToSend);
  const buffer = Math.max(0, Math.floor(bufferCredits));
  const afterGommo = send + GOMMO_MIN_REMAINING_AFTER_SEND + 1;
  const afterBuffer = send + buffer;
  return Math.max(afterBuffer, afterGommo);
}

export function assertMerchantCanCover(input: {
  merchantBalance: number;
  reservedCredits: number;
  creditsToSend: number;
  bufferCredits?: number;
}): void {
  const available = Math.floor(input.merchantBalance) - Math.floor(input.reservedCredits);
  const required = requiredMerchantCredits(input.creditsToSend, input.bufferCredits ?? 0);
  if (available >= required) return;

  const fmt = (n: number) => n.toLocaleString('vi-VN');
  const detail = `need≥${fmt(required)} pkg=${fmt(input.creditsToSend)} available=${fmt(Math.max(0, available))} balance=${fmt(input.merchantBalance)} reserved=${fmt(input.reservedCredits)}`;
  console.warn('[topup] merchant balance insufficient', detail);
  throw new MerchantBalanceError(TOPUP_BALANCE_PAUSE_MESSAGE, detail);
}
