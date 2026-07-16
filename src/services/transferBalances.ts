import { loadAuth, type PlatformUser } from './authStore';

export const MIN_TRANSFER_CREDIT = 1_000;
export const MAX_TRANSFER_CREDIT = 20_000_000;

export interface PlatformTransferInput {
  to: string;
  value: number;
  message: string;
}

export interface PlatformTransferResult {
  message: string;
  amount: number;
  transferId?: string;
  from?: PlatformUser;
  to?: { id: string; email: string; name: string | null; credits: number };
}

async function creditsRequest(
  path: '/api/credits/transfer' | '/api/credits/grant',
  input: PlatformTransferInput,
): Promise<PlatformTransferResult> {
  const auth = loadAuth();
  if (!auth?.platform_token) {
    throw new Error('Chưa đăng nhập tài khoản hệ thống');
  }

  const to = input.to.trim();
  const message = input.message.trim();
  const value = Math.floor(input.value);

  if (!to) throw new Error('Nhập email hoặc SĐT người nhận');
  if (!message) throw new Error('Lời nhắn là bắt buộc');
  if (path === '/api/credits/transfer') {
    if (value < MIN_TRANSFER_CREDIT || value > MAX_TRANSFER_CREDIT) {
      throw new Error(
        `Số credit phải từ ${MIN_TRANSFER_CREDIT.toLocaleString('vi-VN')} đến ${MAX_TRANSFER_CREDIT.toLocaleString('vi-VN')}`,
      );
    }
  } else if (value < 1 || value > MAX_TRANSFER_CREDIT) {
    throw new Error(`Số credit phải từ 1 đến ${MAX_TRANSFER_CREDIT.toLocaleString('vi-VN')}`);
  }

  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${auth.platform_token}`,
    },
    body: JSON.stringify({ to, amount: value, message }),
  });

  const text = await res.text();
  let parsed: {
    success?: boolean;
    message?: string;
    data?: PlatformTransferResult & { message?: string };
  };
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    if (/<\s*html/i.test(text) || /404 Not Found/i.test(text)) {
      throw new Error(
        'API cấp/chuyển credit không tìm thấy trên server. Thử lại sau khi upload grant.php / transfer.php lên VPS.',
      );
    }
    throw new Error(`Máy chủ trả lỗi HTTP ${res.status} (không phải JSON)`);
  }

  if (!res.ok || !parsed.success || !parsed.data) {
    const msg = parsed.message || 'Giao dịch credit thất bại';
    if (res.status === 404 || /không tìm thấy người nhận/i.test(msg)) {
      throw new Error(
        `${msg}. Hãy nhập email đầy đủ (vd: user2@gmail.com) hoặc đúng SĐT / tên đã đăng ký.`,
      );
    }
    throw new Error(msg);
  }

  return {
    message: parsed.data.message || parsed.message || 'Thành công',
    amount: parsed.data.amount ?? value,
    transferId: parsed.data.transferId,
    from: parsed.data.from,
    to: parsed.data.to,
  };
}

/** User → user: trừ credit người gửi. */
export async function transferPlatformCredits(
  input: PlatformTransferInput,
): Promise<PlatformTransferResult> {
  return creditsRequest('/api/credits/transfer', input);
}

/** Admin → user: cấp từ quỹ (không trừ ví admin). */
export async function grantPlatformCredits(
  input: PlatformTransferInput,
): Promise<PlatformTransferResult> {
  return creditsRequest('/api/credits/grant', input);
}

/** @deprecated dùng transferPlatformCredits */
export async function sendBalances(input: {
  username: string;
  value: number;
  message: string;
}): Promise<PlatformTransferResult> {
  return transferPlatformCredits({
    to: input.username,
    value: input.value,
    message: input.message,
  });
}
