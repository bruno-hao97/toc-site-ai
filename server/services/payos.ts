import { PayOS } from '@payos/node';
import { config, isPayOsConfigured } from '../config.js';

let payosClient: PayOS | null = null;

function getPayOsClient(): PayOS {
  if (!isPayOsConfigured()) {
    throw new Error('Chưa cấu hình PayOS — thiếu PAYOS_CLIENT_ID / PAYOS_API_KEY / PAYOS_CHECKSUM_KEY trong .env');
  }
  if (!payosClient) {
    payosClient = new PayOS({
      clientId: config.payos.clientId,
      apiKey: config.payos.apiKey,
      checksumKey: config.payos.checksumKey,
    });
  }
  return payosClient;
}

export interface CreatePayOsPaymentInput {
  planId: string;
  planName: string;
  amount: number;
}

export interface CreateTopupPayOsInput {
  username: string;
  amountVnd: number;
}

function buildTopupDescription(orderCode: number): string {
  return `TU${String(orderCode).slice(-6)}`.slice(0, 9);
}

export interface PayOsPaymentResult {
  status: string;
  url?: string;
  urlEmbedded?: string;
  qrImage?: string;
  bankTransfer: {
    accountName: string;
    bankName: string;
    accountNumber: string;
    amount: string;
    amountFormatted: string;
    content: string;
  };
  orderCode: number;
}

const BANK_BIN_LABELS: Record<string, string> = {
  '970416': 'Ngân hàng TMCP Á Châu (ACB)',
  '970422': 'Ngân hàng Quân đội (MB Bank)',
  '970436': 'Ngân hàng Ngoại thương Việt Nam (Vietcombank)',
  '970415': 'Ngân hàng Công thương Việt Nam (VietinBank)',
  '970418': 'Ngân hàng Đầu tư và Phát triển Việt Nam (BIDV)',
  '970407': 'Ngân hàng Kỹ thương Việt Nam (Techcombank)',
};

function generateOrderCode(): number {
  const suffix = Math.floor(Math.random() * 900) + 100;
  const timePart = Number(String(Date.now()).slice(-6));
  return timePart * 1000 + suffix;
}

function buildPaymentDescription(orderCode: number, planId: string): string {
  const planToken = planId.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() || 'PLAN';
  const codeToken = String(orderCode).slice(-4);
  return `DH${planToken}${codeToken}`.slice(0, 9);
}

function formatAmountVnd(amount: number): string {
  return `${Math.round(amount).toLocaleString('en-US')} VND`;
}

function resolveBankName(bin?: string): string {
  if (!bin) return '';
  return BANK_BIN_LABELS[bin] || `Ngân hàng (BIN ${bin})`;
}

function normalizePayOsError(err: unknown): string {
  if (err && typeof err === 'object') {
    const row = err as Record<string, unknown>;
    const desc = typeof row.desc === 'string' ? row.desc : '';
    const message = typeof row.message === 'string' ? row.message : '';
    const code = typeof row.code === 'string' ? row.code : '';

    if (code === '201' || /signature/i.test(desc) || /signature/i.test(message)) {
      return 'PayOS: Checksum Key không hợp lệ. Hãy copy lại đủ 3 key (Client ID, API Key, Checksum Key) từ cùng một kênh thanh toán trên my.payos.vn, rồi restart server.';
    }
    if (desc) return desc;
    if (message) return message;
  }
  if (err instanceof Error && err.message) return err.message;
  return 'PayOS tạo thanh toán thất bại';
}

export async function createPayOsPayment(input: CreatePayOsPaymentInput): Promise<PayOsPaymentResult> {
  const amount = Math.round(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Số tiền gói không hợp lệ');
  }

  const orderCode = generateOrderCode();
  const description = buildPaymentDescription(orderCode, input.planId);

  try {
    const data = await getPayOsClient().paymentRequests.create({
      orderCode,
      amount,
      description,
      returnUrl: config.payos.planReturnUrl,
      cancelUrl: config.payos.planCancelUrl,
    });

    const transferAmount = data.amount ?? amount;
    const content = data.description || String(data.orderCode ?? orderCode);

    return {
      status: 'success',
      url: data.checkoutUrl,
      urlEmbedded: data.checkoutUrl,
      qrImage: data.qrCode,
      orderCode: data.orderCode ?? orderCode,
      bankTransfer: {
        accountName: data.accountName || '',
        bankName: resolveBankName(data.bin),
        accountNumber: data.accountNumber || '',
        amount: String(transferAmount),
        amountFormatted: formatAmountVnd(transferAmount),
        content,
      },
    };
  } catch (err) {
    throw new Error(normalizePayOsError(err));
  }
}

export async function createTopupPayOsPayment(input: CreateTopupPayOsInput): Promise<PayOsPaymentResult> {
  const amount = Math.round(input.amountVnd);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Số tiền nạp không hợp lệ');
  }

  const orderCode = generateOrderCode();
  const description = buildTopupDescription(orderCode);

  try {
    const data = await getPayOsClient().paymentRequests.create({
      orderCode,
      amount,
      description,
      returnUrl: config.payos.returnUrl,
      cancelUrl: config.payos.cancelUrl,
    });

    const transferAmount = data.amount ?? amount;
    const content = data.description || String(data.orderCode ?? orderCode);

    return {
      status: 'success',
      url: data.checkoutUrl,
      urlEmbedded: data.checkoutUrl,
      qrImage: data.qrCode,
      orderCode: data.orderCode ?? orderCode,
      bankTransfer: {
        accountName: data.accountName || '',
        bankName: resolveBankName(data.bin),
        accountNumber: data.accountNumber || '',
        amount: String(transferAmount),
        amountFormatted: formatAmountVnd(transferAmount),
        content,
      },
    };
  } catch (err) {
    throw new Error(normalizePayOsError(err));
  }
}

export async function verifyPayOsKeys(): Promise<{ ok: boolean; message: string }> {
  if (!isPayOsConfigured()) {
    return { ok: false, message: 'Thiếu PayOS key trong .env' };
  }

  const orderCode = generateOrderCode();
  try {
    await getPayOsClient().paymentRequests.create({
      orderCode,
      amount: 2000,
      description: buildPaymentDescription(orderCode, 'health'),
      returnUrl: config.payos.planReturnUrl,
      cancelUrl: config.payos.planCancelUrl,
    });
    return { ok: true, message: 'PayOS key hợp lệ' };
  } catch (err) {
    return { ok: false, message: normalizePayOsError(err) };
  }
}

export function verifyPayOsWebhookSignature(payload: Record<string, unknown>, signature: string): boolean {
  if (!signature || !isPayOsConfigured()) return false;
  try {
    getPayOsClient().webhooks.verify({ ...payload, signature } as never);
    return true;
  } catch {
    return false;
  }
}
