import { config, isGommoMerchantConfigured } from '../config.js';
import { gommoServerDeviceFields } from './gommoDevice.js';

export interface MerchantSendBalancesInput {
  username: string;
  value: number;
  message: string;
  type?: string;
}

function normalizeSendError(message?: string): string {
  if (!message) return 'Gommo sendBalances thất bại';
  if (/domain/i.test(message)) {
    return 'Merchant token chưa đúng domain — kiểm tra GOMMO_API_DOMAIN.';
  }
  return message;
}

export async function merchantSendBalances(input: MerchantSendBalancesInput): Promise<void> {
  if (!isGommoMerchantConfigured()) {
    throw new Error('Chưa cấu hình GOMMO_ACCESS_TOKEN trên server');
  }

  const username = input.username.trim();
  const message = input.message.trim();
  const value = Math.floor(input.value);

  if (!username) throw new Error('Thiếu username người nhận');
  if (!message) throw new Error('Thiếu message sendBalances');
  if (value <= 0) throw new Error('Số credit không hợp lệ');

  const body = new URLSearchParams({
    access_token: config.gommo.accessToken,
    domain: config.gommo.apiDomain,
    type: input.type || 'credits_ai',
    value: String(value),
    username,
    message,
    ...gommoServerDeviceFields(),
  }).toString();

  const url = `${config.gommo.authBaseUrl}${config.gommo.authPath}/users/sendBalances`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const text = await res.text();
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(text || `HTTP ${res.status}`);
  }

  if (raw.error) {
    throw new Error(normalizeSendError(String(raw.message || '')));
  }
  if (!res.ok) {
    throw new Error(normalizeSendError(String(raw.message || `HTTP ${res.status}`)));
  }
}
