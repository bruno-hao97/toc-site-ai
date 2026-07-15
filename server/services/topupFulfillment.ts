import { config, vndToCredits } from '../config.js';
import { merchantSendBalances } from './gommoSendBalances.js';
import { getTopupOrder, updateTopupOrder } from './topupOrders.js';

export interface PayOsWebhookPayload {
  code?: string;
  desc?: string;
  data?: Record<string, unknown>;
  signature?: string;
}

function extractWebhookData(body: Record<string, unknown>): Record<string, unknown> | null {
  const nested = body.data;
  if (nested && typeof nested === 'object') return nested as Record<string, unknown>;
  return body;
}

export async function fulfillTopupFromWebhook(body: Record<string, unknown>): Promise<{
  ok: boolean;
  message: string;
  orderCode?: number;
}> {
  const code = String(body.code ?? '');
  const data = extractWebhookData(body);
  if (!data) return { ok: true, message: 'Webhook không có data — bỏ qua' };

  const status = String(data.status ?? '').toUpperCase();
  const orderCode = Number(data.orderCode);
  const amount = Number(data.amount);

  if (code !== '00' && status !== 'PAID') {
    return { ok: true, message: `Webhook chưa PAID (code=${code}, status=${status})` };
  }
  if (!Number.isFinite(orderCode) || orderCode <= 0) {
    return { ok: true, message: 'Webhook ping — bỏ qua (không có orderCode)' };
  }

  const order = await getTopupOrder(orderCode);
  if (!order) {
    return { ok: true, message: `Webhook đã nhận — chưa có đơn pending #${orderCode}` };
  }

  if (order.status === 'credited') {
    return { ok: true, message: `Đơn #${orderCode} đã cộng credit trước đó`, orderCode };
  }

  if (Number.isFinite(amount) && amount > 0 && amount !== order.amountVnd) {
    await updateTopupOrder(orderCode, {
      status: 'failed',
      error: `Số tiền PayOS (${amount}) không khớp đơn (${order.amountVnd})`,
    });
    console.error('[payos/webhook] amount mismatch', orderCode, amount, order.amountVnd);
    return { ok: true, message: 'Số tiền thanh toán không khớp đơn pending — đã ghi log' };
  }

  await updateTopupOrder(orderCode, {
    status: 'paid',
    paidAt: new Date().toISOString(),
    payosReference: String(data.reference || data.paymentLinkId || ''),
  });

  const credits = order.credits || vndToCredits(order.amountVnd);
  const message = `PayOS topup #${orderCode}`;

  try {
    await merchantSendBalances({
      username: order.username,
      value: credits,
      message,
    });
    await updateTopupOrder(orderCode, {
      status: 'credited',
      creditedAt: new Date().toISOString(),
      error: undefined,
    });
    return {
      ok: true,
      message: `Đã cộng ${credits} credit cho @${order.username}`,
      orderCode,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await updateTopupOrder(orderCode, { status: 'failed', error: errMsg });
    console.error('[payos/webhook] sendBalances failed', orderCode, errMsg);
    return { ok: true, message: `Đã nhận webhook — lỗi cộng credit: ${errMsg}`, orderCode };
  }
}
