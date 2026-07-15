import { loadAuth } from './authStore';
import { gommoDeviceFields } from './gommoDevice';
import { PRICING_DOMAIN } from './settingsStore';
import { GOMMO_AUTH_BASE, GOMMO_AUTH_PATH } from './upstreamMe';

export type SubscriptionPlanType = 'image' | 'video' | 'combo';

export interface SubscriptionPlanMode {
  type?: string;
  name?: string;
  description?: string;
  price?: number;
}

export interface SubscriptionPlanModelOption {
  type?: string;
  name?: string;
}

export interface SubscriptionPlanModel {
  model?: string;
  name?: string;
  type?: string;
  modes?: Array<SubscriptionPlanMode | string>;
  resolutions?: Array<SubscriptionPlanModelOption | string>;
  durations?: Array<SubscriptionPlanModelOption | string>;
  ratios?: Array<SubscriptionPlanModelOption | string>;
  quota_limit?: number;
  quota_used?: number;
  concurrent?: number;
  concurrent_vip?: number;
}

export interface SubscriptionPlan {
  id_base: string;
  plan_key: string;
  status?: string;
  type: SubscriptionPlanType | string;
  name: string;
  group?: string;
  price: string;
  price_regular?: string;
  save_percent?: string;
  video_day?: string;
  video_month?: string;
  video_vip_day?: string;
  video_vip_month?: string;
  image_day?: string;
  image_month?: string;
  image_vip_day?: string;
  image_vip_month?: string;
  concurrent?: string;
  concurrent_vip?: string;
  queue?: string;
  queue_vip?: string;
  storage?: string;
  models?: SubscriptionPlanModel[];
  tools?: string[];
}

interface PlansPayload {
  data?: SubscriptionPlan[];
  message?: string;
}

interface PaymentPayload {
  error?: number;
  message?: string;
  status?: string;
  url?: string;
  url_embedded?: string;
  runtime?: number;
  qrUrl?: string;
  qrImage?: string;
  bankTransfer?: SubscriptionBankTransferInfo;
}

export interface SubscriptionBankTransferInfo {
  accountName: string;
  bankName: string;
  accountNumber: string;
  amount: string;
  amountFormatted: string;
  content: string;
}

export interface CreateSubscriptionPaymentInput {
  planId: string;
  planName?: string;
  amount?: string | number;
  gateway?: string;
  subscribeType?: string;
  type?: string;
}

export interface SubscriptionPaymentResult {
  status?: string;
  url?: string;
  urlEmbedded?: string;
  qrUrl?: string;
  qrImage?: string;
  bankTransfer?: SubscriptionBankTransferInfo;
  runtime?: number;
}

const PLANS_URL = `${GOMMO_AUTH_BASE}${GOMMO_AUTH_PATH}/subscriptions/plans`;
const CREATE_PAYMENT_URL = `${GOMMO_AUTH_BASE}${GOMMO_AUTH_PATH}/subscriptions/create_payment`;

function normalizePlan(raw: unknown): SubscriptionPlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const idBase = String(row.id_base || row.id || '').trim();
  if (!idBase) return null;
  return { ...(row as unknown as SubscriptionPlan), id_base: idBase };
}

function normalizePlans(rows: unknown[]): SubscriptionPlan[] {
  return rows.map(normalizePlan).filter((plan): plan is SubscriptionPlan => plan !== null);
}

function parsePlansPayload(input: unknown): PlansPayload {
  if (!input || typeof input !== 'object') return {};
  const root = input as Record<string, unknown>;
  if (Array.isArray(root.data)) return { data: normalizePlans(root.data) };
  if (root.data && typeof root.data === 'object') {
    const nested = root.data as Record<string, unknown>;
    if (Array.isArray(nested.data)) return { data: normalizePlans(nested.data) };
  }
  return { message: typeof root.message === 'string' ? root.message : undefined };
}

export async function fetchSubscriptionPlans(type: SubscriptionPlanType): Promise<SubscriptionPlan[]> {
  const auth = loadAuth();
  if (!auth?.access_token) throw new Error('Chưa đăng nhập — thiếu access token');

  const body = new URLSearchParams({
    action_type: 'plans',
    type,
    domain: PRICING_DOMAIN,
    access_token: auth.access_token.trim(),
    ...gommoDeviceFields(),
  }).toString();

  const res = await fetch(PLANS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const text = await res.text();

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(text || `HTTP ${res.status}`);
  }

  const payload = parsePlansPayload(raw);
  if (!res.ok) throw new Error(payload.message || `HTTP ${res.status}`);
  if (!Array.isArray(payload.data)) throw new Error(payload.message || 'Sai định dạng dữ liệu plans');
  return payload.data;
}

function collectPaymentSources(input: unknown): Record<string, unknown>[] {
  const sources: Record<string, unknown>[] = [];
  if (!input || typeof input !== 'object') return sources;

  const root = input as Record<string, unknown>;
  sources.push(root);

  const pushObject = (value: unknown) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      sources.push(value as Record<string, unknown>);
    }
  };

  pushObject(root.data);
  pushObject(root.payment);
  pushObject(root.bank);
  pushObject(root.transfer);

  const data = root.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const nested = data as Record<string, unknown>;
    pushObject(nested.payment);
    pushObject(nested.bank);
    pushObject(nested.transfer);
    pushObject(nested.payment_info);
    pushObject(nested.bank_transfer);
  }

  return sources;
}

function pickPaymentField(sources: Record<string, unknown>[], keys: string[]): string {
  for (const source of sources) {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    }
  }
  return '';
}

function formatPaymentAmount(value: string): { raw: string; formatted: string } {
  const trimmed = value.trim();
  if (!trimmed) return { raw: '', formatted: '' };
  const numeric = Number(trimmed.replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return { raw: trimmed, formatted: trimmed };
  }
  const formattedNumber = Math.round(numeric).toLocaleString('en-US');
  return {
    raw: String(Math.round(numeric)),
    formatted: `${formattedNumber} VND`,
  };
}

function formatAmountNote(value: string): string {
  const numeric = Number(value.replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(numeric) || numeric <= 0) return value;
  return Math.round(numeric).toLocaleString('vi-VN');
}

function parseBankTransfer(sources: Record<string, unknown>[]): SubscriptionBankTransferInfo | undefined {
  const accountName = pickPaymentField(sources, [
    'account_name',
    'accountName',
    'account_holder',
    'holder_name',
    'name',
    'beneficiary',
  ]);
  const bankName = pickPaymentField(sources, ['bank_name', 'bankName', 'bank', 'bank_short_name', 'bank_full_name']);
  const accountNumber = pickPaymentField(sources, [
    'account_number',
    'accountNumber',
    'account_no',
    'bank_account',
    'so_tai_khoan',
    'va',
  ]);
  const content = pickPaymentField(sources, [
    'content',
    'transfer_content',
    'description',
    'payment_content',
    'noi_dung',
    'order_code',
    'payment_code',
    'reference',
    'memo',
  ]);
  const amountRaw = pickPaymentField(sources, ['amount', 'price', 'total', 'so_tien', 'money']);

  if (!accountNumber && !content && !accountName) return undefined;

  const amount = formatPaymentAmount(amountRaw);
  return {
    accountName,
    bankName,
    accountNumber,
    amount: amount.raw,
    amountFormatted: amount.formatted,
    content,
  };
}

function parsePaymentPayload(input: unknown): PaymentPayload {
  if (!input || typeof input !== 'object') return {};
  const root = input as Record<string, unknown>;
  const sources = collectPaymentSources(input);
  const qrUrl = pickPaymentField(sources, ['qr_url', 'qrUrl', 'qrcode_url', 'qr_link']);
  const qrImage = pickPaymentField(sources, ['qr', 'qr_code', 'qrcode', 'qr_image', 'image_qr']);
  const bankTransfer = parseBankTransfer(sources);

  return {
    error: typeof root.error === 'number' ? root.error : undefined,
    message: typeof root.message === 'string' ? root.message : undefined,
    status: typeof root.status === 'string' ? root.status : undefined,
    url: typeof root.url === 'string' ? root.url : pickPaymentField(sources, ['url', 'checkout_url', 'payment_url']),
    url_embedded:
      typeof root.url_embedded === 'string'
        ? root.url_embedded
        : pickPaymentField(sources, ['url_embedded', 'embedded_url', 'iframe_url']),
    runtime: typeof root.runtime === 'number' ? root.runtime : undefined,
    qrUrl: qrUrl || undefined,
    qrImage: qrImage || undefined,
    bankTransfer,
  };
}

export function formatTransferAmountNote(amount: string): string {
  return formatAmountNote(amount);
}

function normalizePaymentError(message?: string): string {
  if (!message) return 'Không tạo được link thanh toán';
  if (/domain/i.test(message)) {
    return 'Bạn cần truy cập đúng domain đã đăng ký để mua gói hoặc nạp credit.';
  }
  return message;
}

function parsePayOsApiResult(raw: unknown): SubscriptionPaymentResult {
  if (!raw || typeof raw !== 'object') throw new Error('Sai định dạng PayOS');
  const root = raw as Record<string, unknown>;
  if (!root.success) throw new Error(typeof root.message === 'string' ? root.message : 'PayOS thất bại');

  const data = root.data;
  if (!data || typeof data !== 'object') throw new Error('PayOS không trả dữ liệu thanh toán');
  const payment = data as Record<string, unknown>;
  const bank = payment.bankTransfer;
  const bankTransfer =
    bank && typeof bank === 'object'
      ? {
          accountName: String((bank as Record<string, unknown>).accountName || ''),
          bankName: String((bank as Record<string, unknown>).bankName || ''),
          accountNumber: String((bank as Record<string, unknown>).accountNumber || ''),
          amount: String((bank as Record<string, unknown>).amount || ''),
          amountFormatted: String((bank as Record<string, unknown>).amountFormatted || ''),
          content: String((bank as Record<string, unknown>).content || ''),
        }
      : undefined;

  return {
    status: typeof payment.status === 'string' ? payment.status : 'success',
    url: typeof payment.url === 'string' ? payment.url : undefined,
    urlEmbedded: typeof payment.urlEmbedded === 'string' ? payment.urlEmbedded : undefined,
    qrImage: typeof payment.qrImage === 'string' ? payment.qrImage : undefined,
    bankTransfer,
  };
}

async function createLocalPayOsPayment(input: CreateSubscriptionPaymentInput): Promise<SubscriptionPaymentResult> {
  const amount = Number(String(input.amount ?? '').replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Số tiền gói không hợp lệ');
  }

  const res = await fetch('/api/payos/payment-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      planId: input.planId.trim(),
      planName: input.planName?.trim() || 'Gói đăng ký',
      amount,
    }),
  });

  const text = await res.text();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(text || `HTTP ${res.status}`);
  }

  if (!res.ok) {
    const message =
      raw && typeof raw === 'object' && typeof (raw as Record<string, unknown>).message === 'string'
        ? String((raw as Record<string, unknown>).message)
        : `HTTP ${res.status}`;
    throw new Error(message);
  }

  return parsePayOsApiResult(raw);
}

export async function createSubscriptionPayment(
  input: CreateSubscriptionPaymentInput,
): Promise<SubscriptionPaymentResult> {
  const gateway = input.gateway || 'payos';
  if (gateway === 'payos') {
    return createLocalPayOsPayment(input);
  }

  const auth = loadAuth();
  if (!auth?.access_token) throw new Error('Chưa đăng nhập — thiếu access token');
  if (!input.planId?.trim()) throw new Error('Thiếu plan_id');

  const body = new URLSearchParams({
    access_token: auth.access_token.trim(),
    domain: PRICING_DOMAIN,
    plan_id: input.planId.trim(),
    subscribe_type: input.subscribeType || 'MEMBER_PLAN_AI',
    type: input.type || 'ai_plan',
    gateway: input.gateway || 'payos',
    ...gommoDeviceFields(),
  }).toString();

  const res = await fetch(CREATE_PAYMENT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const text = await res.text();

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(text || `HTTP ${res.status}`);
  }

  const payload = parsePaymentPayload(raw);
  if (!res.ok) throw new Error(normalizePaymentError(payload.message) || `HTTP ${res.status}`);
  if (payload.error) throw new Error(normalizePaymentError(payload.message));
  if (payload.status && payload.status.toLowerCase() !== 'success') {
    throw new Error(normalizePaymentError(payload.message || 'Tạo thanh toán thất bại'));
  }

  const hasPaymentSurface = Boolean(
    payload.url ||
      payload.url_embedded ||
      payload.qrUrl ||
      payload.qrImage ||
      payload.bankTransfer?.accountNumber ||
      payload.bankTransfer?.content,
  );
  if (!hasPaymentSurface) {
    throw new Error(normalizePaymentError(payload.message || 'Không nhận được thông tin thanh toán'));
  }

  return {
    status: payload.status,
    url: payload.url,
    urlEmbedded: payload.url_embedded,
    qrUrl: payload.qrUrl,
    qrImage: payload.qrImage,
    bankTransfer: payload.bankTransfer,
    runtime: payload.runtime,
  };
}
