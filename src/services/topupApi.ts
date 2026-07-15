export interface TopupBankTransfer {
  accountName: string;
  bankName: string;
  accountNumber: string;
  amount: string;
  amountFormatted: string;
  content: string;
}

export interface TopupPaymentResult {
  status: string;
  url?: string;
  urlEmbedded?: string;
  qrImage?: string;
  orderCode: number;
  username: string;
  packageId: string;
  credits: number;
  bankTransfer: TopupBankTransfer;
}

export type TopupOrderStatus = 'pending' | 'paid' | 'credited' | 'failed';

export interface TopupOrder {
  orderCode: number;
  username: string;
  packageId?: string;
  amountVnd: number;
  credits: number;
  status: TopupOrderStatus;
  createdAt: string;
  paidAt?: string;
  creditedAt?: string;
  error?: string;
}

export interface CreditPackage {
  id: string;
  name: string;
  amountVnd: number;
  credits: number;
  bonusPercent: number;
  featured?: boolean;
  prioritySupport?: boolean;
}

export async function fetchCreditPackages(): Promise<CreditPackage[]> {
  const res = await fetch('/api/payos/credit-packages');
  const text = await res.text();
  let raw: { success?: boolean; message?: string; data?: CreditPackage[] };
  try {
    raw = JSON.parse(text) as typeof raw;
  } catch {
    throw new Error(text || `HTTP ${res.status}`);
  }
  if (!res.ok || !raw.success || !Array.isArray(raw.data)) {
    throw new Error(raw.message || `HTTP ${res.status}`);
  }
  return raw.data;
}

export async function createTopupRequest(username: string, packageId: string): Promise<TopupPaymentResult> {
  const res = await fetch('/api/payos/topup-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, packageId }),
  });

  const text = await res.text();
  let raw: { success?: boolean; message?: string; data?: TopupPaymentResult };
  try {
    raw = JSON.parse(text) as typeof raw;
  } catch {
    throw new Error(text || `HTTP ${res.status}`);
  }

  if (!res.ok || !raw.success || !raw.data) {
    throw new Error(raw.message || `HTTP ${res.status}`);
  }

  return raw.data;
}

export async function fetchTopupOrder(orderCode: number): Promise<TopupOrder> {
  const res = await fetch(`/api/payos/topup-orders/${orderCode}`);
  const text = await res.text();
  let raw: { success?: boolean; message?: string; data?: TopupOrder };
  try {
    raw = JSON.parse(text) as typeof raw;
  } catch {
    throw new Error(text || `HTTP ${res.status}`);
  }
  if (!res.ok || !raw.success || !raw.data) {
    throw new Error(raw.message || `HTTP ${res.status}`);
  }
  return raw.data;
}
