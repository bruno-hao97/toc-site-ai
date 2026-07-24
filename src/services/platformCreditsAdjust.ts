import { loadAuth, notifyCreditsUpdated } from './authStore';
import { PLATFORM_BRIDGE } from './platformBridge';

export async function adjustPlatformCredits(input: {
  action: 'charge' | 'refund';
  amount: number;
  message?: string;
}): Promise<{ credits: number; amount: number; action: string }> {
  const auth = loadAuth();
  const token = auth?.platform_token?.trim();
  if (!token) throw new Error('Chưa đăng nhập');

  const amount = Math.floor(Number(input.amount));
  if (!Number.isFinite(amount) || amount < 1) {
    throw new Error('Số credit không hợp lệ');
  }

  const res = await fetch(PLATFORM_BRIDGE.creditsAdjust, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: input.action,
      amount,
      message: input.message || '',
    }),
  });

  const text = await res.text();
  let parsed: {
    success?: boolean;
    message?: string;
    data?: { credits?: number; amount?: number; action?: string };
  };
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    throw new Error(text.slice(0, 200) || `HTTP ${res.status}`);
  }
  if (!res.ok || !parsed.success || !parsed.data) {
    throw new Error(parsed.message || `HTTP ${res.status}`);
  }

  notifyCreditsUpdated();
  return {
    credits: Number(parsed.data.credits ?? 0),
    amount: Number(parsed.data.amount ?? amount),
    action: String(parsed.data.action ?? input.action),
  };
}

export async function chargePlatformCredits(amount: number, message?: string) {
  return adjustPlatformCredits({ action: 'charge', amount, message });
}

export async function refundPlatformCredits(amount: number, message?: string) {
  return adjustPlatformCredits({ action: 'refund', amount, message });
}
