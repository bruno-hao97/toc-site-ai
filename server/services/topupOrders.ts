import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

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
  payosReference?: string;
  error?: string;
}

interface OrderStore {
  orders: Record<string, TopupOrder>;
}

let writeQueue: Promise<void> = Promise.resolve();

async function ensureStoreFile(): Promise<void> {
  const dir = path.dirname(config.topup.ordersFile);
  await fs.mkdir(dir, { recursive: true });
  try {
    await fs.access(config.topup.ordersFile);
  } catch {
    await fs.writeFile(config.topup.ordersFile, JSON.stringify({ orders: {} }, null, 2), 'utf8');
  }
}

async function readStore(): Promise<OrderStore> {
  await ensureStoreFile();
  const raw = await fs.readFile(config.topup.ordersFile, 'utf8');
  try {
    const parsed = JSON.parse(raw) as OrderStore;
    if (parsed && typeof parsed === 'object' && parsed.orders) return parsed;
  } catch {
    /* reset below */
  }
  return { orders: {} };
}

function queueWrite(task: () => Promise<void>): Promise<void> {
  writeQueue = writeQueue.then(task, task);
  return writeQueue;
}

async function writeStore(store: OrderStore): Promise<void> {
  await fs.writeFile(config.topup.ordersFile, JSON.stringify(store, null, 2), 'utf8');
}

export async function createTopupOrder(input: {
  orderCode: number;
  username: string;
  packageId: string;
  amountVnd: number;
  credits: number;
}): Promise<TopupOrder> {
  const order: TopupOrder = {
    orderCode: input.orderCode,
    username: input.username,
    packageId: input.packageId,
    amountVnd: input.amountVnd,
    credits: input.credits,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  await queueWrite(async () => {
    const store = await readStore();
    store.orders[String(input.orderCode)] = order;
    await writeStore(store);
  });

  return order;
}

export async function getTopupOrder(orderCode: number): Promise<TopupOrder | null> {
  const store = await readStore();
  return store.orders[String(orderCode)] ?? null;
}

/** Tổng credit các đơn còn mở (pending/paid) — giữ chỗ trước khi tạo QR mới. */
export async function sumOpenTopupCredits(excludeOrderCode?: number): Promise<number> {
  const store = await readStore();
  let sum = 0;
  for (const order of Object.values(store.orders)) {
    if (excludeOrderCode != null && order.orderCode === excludeOrderCode) continue;
    if (order.status !== 'pending' && order.status !== 'paid') continue;
    sum += Math.max(0, Math.floor(order.credits || 0));
  }
  return sum;
}

/** Tìm đơn pending/paid theo nội dung CK ngân hàng + số tiền. */
export async function findTopupOrderByBankTransfer(input: {
  content: string;
  amountVnd: number;
}): Promise<TopupOrder | null> {
  const store = await readStore();
  const normalized = String(input.content || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const amount = Math.round(input.amountVnd);
  if (!normalized || !Number.isFinite(amount) || amount <= 0) return null;

  const open = Object.values(store.orders).filter(
    (o) => (o.status === 'pending' || o.status === 'paid') && o.amountVnd === amount,
  );
  if (open.length === 0) return null;

  const preferred: number[] = [];
  const topupMatch = normalized.match(/TOPUP(\d{6,15})/);
  if (topupMatch) preferred.push(Number(topupMatch[1]));
  for (const digits of normalized.match(/\d{6,15}/g) || []) {
    preferred.push(Number(digits));
  }

  for (const code of preferred) {
    if (!Number.isFinite(code) || code <= 0) continue;
    const hit = open.find((o) => o.orderCode === code);
    if (hit) return hit;
  }

  // Fallback: đúng 1 đơn cùng số tiền và content chứa orderCode
  const byContent = open.filter((o) => normalized.includes(String(o.orderCode)));
  if (byContent.length === 1) return byContent[0];

  return null;
}

export async function updateTopupOrder(
  orderCode: number,
  patch: Partial<TopupOrder>,
): Promise<TopupOrder | null> {
  let updated: TopupOrder | null = null;

  await queueWrite(async () => {
    const store = await readStore();
    const key = String(orderCode);
    const current = store.orders[key];
    if (!current) return;
    updated = { ...current, ...patch };
    store.orders[key] = updated;
    await writeStore(store);
  });

  return updated;
}
