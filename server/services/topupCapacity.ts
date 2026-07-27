import { assertAdminPlatformCanCover, fetchAdminPlatformCredits } from './adminPlatformBalance.js';
import {
  assertMerchantCanCover,
  fetchMerchantCreditsAi,
  MerchantBalanceError,
  TOPUP_BALANCE_PAUSE_MESSAGE,
} from './gommoMerchantBalance.js';
import { sumOpenTopupCredits } from './topupOrders.js';

export { MerchantBalanceError, TOPUP_BALANCE_PAUSE_MESSAGE };

/**
 * Check ví admin platform + ví Gommo merchant trước khi tạo QR / cộng credit.
 * reserved = tổng credit các đơn pending|paid chưa credited.
 * Khi fulfill đơn đang xử lý: truyền excludeOrderCode để không đếm trùng gói đó.
 */
export async function assertTopupWalletsCanCover(
  creditsToSend: number,
  excludeOrderCode?: number,
): Promise<void> {
  const send = Math.floor(creditsToSend);
  if (!Number.isFinite(send) || send <= 0) {
    throw new Error('Số credit gói không hợp lệ');
  }

  const reservedCredits = await sumOpenTopupCredits(excludeOrderCode);

  const [adminBalance, merchantBalance] = await Promise.all([
    fetchAdminPlatformCredits(),
    fetchMerchantCreditsAi(),
  ]);

  assertAdminPlatformCanCover({
    adminBalance,
    reservedCredits,
    creditsToSend: send,
  });

  assertMerchantCanCover({
    merchantBalance,
    reservedCredits,
    creditsToSend: send,
    bufferCredits: 0,
  });
}
