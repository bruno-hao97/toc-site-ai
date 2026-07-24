import { config, vndToCredits } from '../config.js';
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

/** Cộng credit platform từ ví admin (không mint / không sendBalances merchant). */
async function creditUserFromAdminWallet(input: {
  username: string;
  credits: number;
  message: string;
}): Promise<void> {
  const bridge = config.auth.bridgeUrl.replace(/\/$/, '');
  const key = config.topup.bridgeServiceKey;
  if (!bridge) {
    throw new Error('AUTH_BRIDGE_URL chưa cấu hình — không cộng credit platform được');
  }
  if (!key) {
    throw new Error('BRIDGE_SERVICE_KEY / MIGRATE_KEY chưa cấu hình (khớp migrate_key PHP)');
  }

  const url = `${bridge}/credit-from-admin.php`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key,
      to: input.username,
      amount: input.credits,
      message: input.message,
      kind: 'topup_sale',
    }),
  });

  const text = await res.text();
  let parsed: { success?: boolean; message?: string };
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    throw new Error(text.slice(0, 200) || `HTTP ${res.status}`);
  }
  if (!res.ok || !parsed.success) {
    throw new Error(parsed.message || `HTTP ${res.status}`);
  }
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
    await creditUserFromAdminWallet({
      username: order.username,
      credits,
      message,
    });
    await updateTopupOrder(orderCode, {
      status: 'credited',
      creditedAt: new Date().toISOString(),
      error: undefined,
    });
    return {
      ok: true,
      message: `Đã cộng ${credits} credit (trừ ví admin) cho @${order.username}`,
      orderCode,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await updateTopupOrder(orderCode, { status: 'failed', error: errMsg });
    console.error('[payos/webhook] credit-from-admin failed', orderCode, errMsg);
    return { ok: true, message: `Đã nhận webhook — lỗi cộng credit: ${errMsg}`, orderCode };
  }
}

/** Pay2S IPN — resultCode=0 nghĩa là thanh toán thành công. */
export async function fulfillTopupFromPay2sIpn(body: Record<string, unknown>): Promise<{
  ok: boolean;
  message: string;
  orderCode?: number;
}> {
  const resultCode = Number(body.resultCode);
  const orderCode = Number(body.orderId);
  const amount = Number(body.amount);

  if (!Number.isFinite(resultCode) || (resultCode !== 0 && resultCode !== 9000)) {
    return {
      ok: true,
      message: `IPN chưa thành công (resultCode=${body.resultCode}, message=${body.message ?? ''})`,
    };
  }

  if (!Number.isFinite(orderCode) || orderCode <= 0) {
    return { ok: true, message: 'IPN bỏ qua — orderId không hợp lệ' };
  }

  const order = await getTopupOrder(orderCode);
  if (!order) {
    return { ok: true, message: `IPN đã nhận — chưa có đơn pending #${orderCode}`, orderCode };
  }

  if (order.status === 'credited') {
    return { ok: true, message: `Đơn #${orderCode} đã cộng credit trước đó`, orderCode };
  }

  if (Number.isFinite(amount) && amount > 0 && amount !== order.amountVnd) {
    await updateTopupOrder(orderCode, {
      status: 'failed',
      error: `Số tiền Pay2S (${amount}) không khớp đơn (${order.amountVnd})`,
    });
    console.error('[pay2s/ipn] amount mismatch', orderCode, amount, order.amountVnd);
    return { ok: true, message: 'Số tiền thanh toán không khớp đơn pending — đã ghi log', orderCode };
  }

  await updateTopupOrder(orderCode, {
    status: 'paid',
    paidAt: new Date().toISOString(),
    payosReference: String(body.transId || body.requestId || ''),
  });

  const credits = order.credits || vndToCredits(order.amountVnd);
  const message = `Pay2S topup #${orderCode}`;

  try {
    await creditUserFromAdminWallet({
      username: order.username,
      credits,
      message,
    });
    await updateTopupOrder(orderCode, {
      status: 'credited',
      creditedAt: new Date().toISOString(),
      error: undefined,
    });
    return {
      ok: true,
      message: `Đã cộng ${credits} credit (trừ ví admin) cho @${order.username}`,
      orderCode,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await updateTopupOrder(orderCode, { status: 'failed', error: errMsg });
    console.error('[pay2s/ipn] credit-from-admin failed', orderCode, errMsg);
    return { ok: true, message: `Đã nhận IPN — lỗi cộng credit: ${errMsg}`, orderCode };
  }
}
