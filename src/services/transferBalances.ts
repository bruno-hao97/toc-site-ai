import { loadAuth } from './authStore';
import { gommoDeviceFields } from './gommoDevice';
import { GOMMO_AUTH_BASE, GOMMO_AUTH_PATH } from './upstreamMe';

export const MIN_TRANSFER_CREDIT = 10_000;
export const MAX_TRANSFER_CREDIT = 20_000_000;

export interface SendBalancesInput {
  username: string;
  value: number;
  message: string;
  type?: string;
}

export interface SendBalancesResult {
  message?: string;
  runtime?: number;
}

function normalizeTransferError(message?: string): string {
  if (!message) return 'Chuyển credit thất bại';
  if (/domain/i.test(message)) {
    return 'Bạn cần truy cập đúng domain đã đăng ký để chuyển credit.';
  }
  return message;
}

export async function sendBalances(input: SendBalancesInput): Promise<SendBalancesResult> {
  const auth = loadAuth();
  if (!auth?.access_token) throw new Error('Chưa đăng nhập');

  const username = input.username.trim();
  const message = input.message.trim();
  const value = Math.floor(input.value);

  if (!username) throw new Error('Nhập username người nhận');
  if (!message) throw new Error('Lời nhắn là bắt buộc');
  if (value < MIN_TRANSFER_CREDIT || value > MAX_TRANSFER_CREDIT) {
    throw new Error(
      `Số credit phải từ ${MIN_TRANSFER_CREDIT.toLocaleString('vi-VN')} đến ${MAX_TRANSFER_CREDIT.toLocaleString('vi-VN')}`,
    );
  }

  const body = new URLSearchParams({
    access_token: auth.access_token.trim(),
    domain: auth.domain.trim(),
    type: input.type || 'credits_ai',
    value: String(value),
    username,
    message,
    ...gommoDeviceFields(),
  }).toString();

  const res = await fetch(`${GOMMO_AUTH_BASE}${GOMMO_AUTH_PATH}/users/sendBalances`, {
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
    throw new Error(normalizeTransferError(String(raw.message || '')));
  }
  if (!res.ok) {
    throw new Error(normalizeTransferError(String(raw.message || `HTTP ${res.status}`)));
  }

  return {
    message: typeof raw.message === 'string' ? raw.message : 'Chuyển credit thành công',
    runtime: typeof raw.runtime === 'number' ? raw.runtime : undefined,
  };
}
