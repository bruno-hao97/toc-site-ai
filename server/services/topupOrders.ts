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
