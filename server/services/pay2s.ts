import crypto from 'node:crypto';
import { config, isPay2sConfigured } from '../config.js';

export interface CreatePay2sPaymentInput {
  planId: string;
  planName: string;
  amount: number;
}

export interface CreateTopupPay2sInput {
  username: string;
  amountVnd: number;
}

export interface Pay2sPaymentResult {
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
  requestId?: string;
  orderId?: string;
}

const BANK_LABELS: Record<string, string> = {
  ACB: 'Ngân hàng TMCP Á Châu (ACB)',
  MB: 'Ngân hàng Quân đội (MB Bank)',
  VCB: 'Ngân hàng Ngoại thương Việt Nam (Vietcombank)',
  VIETCOMBANK: 'Ngân hàng Ngoại thương Việt Nam (Vietcombank)',
  CTG: 'Ngân hàng Công thương Việt Nam (VietinBank)',
  VIETINBANK: 'Ngân hàng Công thương Việt Nam (VietinBank)',
  BIDV: 'Ngân hàng Đầu tư và Phát triển Việt Nam (BIDV)',
  TCB: 'Ngân hàng Kỹ thương Việt Nam (Techcombank)',
  TECHCOMBANK: 'Ngân hàng Kỹ thương Việt Nam (Techcombank)',
};

function generateOrderCode(): number {
  const suffix = Math.floor(Math.random() * 900) + 100;
  const timePart = Number(String(Date.now()).slice(-6));
  return timePart * 1000 + suffix;
}

/** Pay2S orderInfo: 10–32 ký tự, chỉ chữ + số. */
function buildOrderInfo(prefix: string, orderCode: number): string {
  const raw = `${prefix}${orderCode}`.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const padded = raw.length < 10 ? `${raw}X`.padEnd(10, '0') : raw;
  return padded.slice(0, 32);
}

function formatAmountVnd(amount: number): string {
  return `${Math.round(amount).toLocaleString('en-US')} VND`;
}

function resolveBankName(bankId?: string): string {
  if (!bankId) return '';
  const key = bankId.toUpperCase();
  return BANK_LABELS[key] || bankId;
}

function hmacSha256(raw: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(raw).digest('hex');
}

function buildCreateSignature(params: {
  accessKey: string;
  amount: string;
  ipnUrl: string;
  orderId: string;
  orderInfo: string;
  partnerCode: string;
  redirectUrl: string;
  requestId: string;
  requestType: string;
}): string {
  const rawHash =
    `accessKey=${params.accessKey}` +
    `&amount=${params.amount}` +
    `&bankAccounts=Array` +
    `&ipnUrl=${params.ipnUrl}` +
    `&orderId=${params.orderId}` +
    `&orderInfo=${params.orderInfo}` +
    `&partnerCode=${params.partnerCode}` +
    `&redirectUrl=${params.redirectUrl}` +
    `&requestId=${params.requestId}` +
    `&requestType=${params.requestType}`;
  return hmacSha256(rawHash, config.pay2s.secretKey);
}

export function verifyPay2sIpnSignature(body: Record<string, unknown>): boolean {
  if (!isPay2sConfigured()) return false;
  const m2signature = String(body.m2signature || body.signature || '');
  if (!m2signature) return false;

  const amount = body.amount ?? '';
  const extraData = body.extraData ?? '';
  const message = body.message ?? '';
  const orderId = body.orderId ?? '';
  const orderInfo = body.orderInfo ?? '';
  const orderType = body.orderType ?? '';
  const partnerCode = body.partnerCode ?? '';
  const payType = body.payType ?? '';
  const requestId = body.requestId ?? '';
  const responseTime = body.responseTime ?? '';
  const resultCode = body.resultCode ?? '';
  const transId = body.transId ?? '';

  const rawHash =
    `accessKey=${config.pay2s.accessKey}` +
    `&amount=${amount}` +
    `&extraData=${extraData}` +
    `&message=${message}` +
    `&orderId=${orderId}` +
    `&orderInfo=${orderInfo}` +
    `&orderType=${orderType}` +
    `&partnerCode=${partnerCode}` +
    `&payType=${payType}` +
    `&requestId=${requestId}` +
    `&responseTime=${responseTime}` +
    `&resultCode=${resultCode}` +
    `&transId=${transId}`;

  const expected = hmacSha256(rawHash, config.pay2s.secretKey);
  try {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(m2signature, 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return expected === m2signature;
  }
}

interface Pay2sQrItem {
  bank_id?: string;
  account_number?: string;
  account_name?: string;
  qrCode?: string;
  qrUrl?: string;
}

interface Pay2sCreateResponse {
  resultCode?: number | string;
  message?: string;
  payUrl?: string;
  orderId?: string;
  requestId?: string;
  amount?: string | number;
  qrList?: Pay2sQrItem[];
}

async function createPay2sPaymentLink(input: {
  amount: number;
  orderInfo: string;
  orderCode: number;
}): Promise<Pay2sPaymentResult> {
  if (!isPay2sConfigured()) {
    throw new Error(
      'Chưa cấu hình Pay2S — thiếu PAY2S_PARTNER_CODE / PAY2S_ACCESS_KEY / PAY2S_SECRET_KEY / PAY2S_BANK_ACCOUNT trong .env',
    );
  }

  const amount = Math.round(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Số tiền không hợp lệ');
  }

  // Pay2S Postman mẫu: requestId === orderId (timestamp string)
  const orderId = String(input.orderCode);
  const requestId = orderId;
  const requestType = 'pay2s';
  const amountStr = String(amount);
  const { accessKey, partnerCode, partnerName, redirectUrl, ipnUrl, bankAccountNumber, bankId, apiCreateUrl } =
    config.pay2s;

  const signature = buildCreateSignature({
    accessKey,
    amount: amountStr,
    ipnUrl,
    orderId,
    orderInfo: input.orderInfo,
    partnerCode,
    redirectUrl,
    requestId,
    requestType,
  });

  const body = {
    accessKey,
    partnerCode,
    partnerName,
    requestId,
    amount: amountStr,
    orderId,
    orderInfo: input.orderInfo,
    orderType: requestType,
    bankAccounts: [
      {
        account_number: bankAccountNumber,
        bank_id: bankId,
      },
    ],
    redirectUrl,
    ipnUrl,
    requestType,
    lang: 'vi',
    signature,
  };

  const res = await fetch(apiCreateUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data: Pay2sCreateResponse;
  try {
    data = JSON.parse(text) as Pay2sCreateResponse;
  } catch {
    throw new Error(text || `Pay2S HTTP ${res.status}`);
  }

  const resultCode = Number(data.resultCode);
  if (!res.ok || resultCode !== 0) {
    const detail = data.message || `Pay2S tạo thanh toán thất bại (code=${data.resultCode})`;
    console.error('[pay2s/create]', detail, {
      orderId,
      requestId,
      amount: amountStr,
      apiCreateUrl,
      partnerCode,
    });
    throw new Error(detail);
  }

  const qr = Array.isArray(data.qrList) && data.qrList.length > 0 ? data.qrList[0] : undefined;
  const transferAmount = Number(data.amount ?? amount);
  const content = input.orderInfo;

  return {
    status: 'success',
    url: data.payUrl,
    urlEmbedded: data.payUrl,
    qrImage: qr?.qrCode || qr?.qrUrl,
    orderCode: input.orderCode,
    requestId: data.requestId || requestId,
    orderId: data.orderId || orderId,
    bankTransfer: {
      accountName: qr?.account_name || partnerName,
      bankName: resolveBankName(qr?.bank_id || bankId),
      accountNumber: qr?.account_number || bankAccountNumber,
      amount: String(transferAmount),
      amountFormatted: formatAmountVnd(transferAmount),
      content,
    },
  };
}

export async function createPay2sPayment(input: CreatePay2sPaymentInput): Promise<Pay2sPaymentResult> {
  const orderCode = generateOrderCode();
  const planToken = input.planId.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() || 'PLAN';
  const orderInfo = buildOrderInfo(`DH${planToken}`, orderCode);
  return createPay2sPaymentLink({
    amount: input.amount,
    orderInfo,
    orderCode,
  });
}

export async function createTopupPay2sPayment(input: CreateTopupPay2sInput): Promise<Pay2sPaymentResult> {
  const orderCode = generateOrderCode();
  const orderInfo = buildOrderInfo('TOPUP', orderCode);
  return createPay2sPaymentLink({
    amount: input.amountVnd,
    orderInfo,
    orderCode,
  });
}

export async function verifyPay2sKeys(): Promise<{ ok: boolean; message: string }> {
  if (!isPay2sConfigured()) {
    return { ok: false, message: 'Thiếu Pay2S key / bank account trong .env' };
  }

  try {
    const orderCode = generateOrderCode();
    await createPay2sPaymentLink({
      amount: 2000,
      orderInfo: buildOrderInfo('HEALTH', orderCode),
      orderCode,
    });
    return { ok: true, message: 'Pay2S key hợp lệ' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message };
  }
}
