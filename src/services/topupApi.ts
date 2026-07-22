import { apiUnavailableMessage, readJsonResponse } from './apiResponse';

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
  const res = await fetch('/api/platform/credit-packages.php');
  const raw = await readJsonResponse<{ success?: boolean; message?: string; data?: CreditPackage[] }>(res);
  if (!res.ok || !raw.success || !Array.isArray(raw.data)) {
    throw new Error(raw.message || apiUnavailableMessage(res.status));
  }
  return raw.data;
}

export async function createTopupRequest(username: string, packageId: string): Promise<TopupPaymentResult> {
  const res = await fetch('/api/pay2s/topup-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, packageId }),
  });

  const raw = await readJsonResponse<{ success?: boolean; message?: string; data?: TopupPaymentResult }>(res);
  if (!res.ok || !raw.success || !raw.data) {
    throw new Error(raw.message || apiUnavailableMessage(res.status));
  }

  return raw.data;
}

export async function fetchTopupOrder(orderCode: number): Promise<TopupOrder> {
  const res = await fetch(`/api/pay2s/topup-orders/${orderCode}`);
  const raw = await readJsonResponse<{ success?: boolean; message?: string; data?: TopupOrder }>(res);
  if (!res.ok || !raw.success || !raw.data) {
    throw new Error(raw.message || apiUnavailableMessage(res.status));
  }
  return raw.data;
}
