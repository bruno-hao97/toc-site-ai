import 'dotenv/config';
import path from 'node:path';

const appUrl = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');

export const config = {
  port: Number(process.env.PORT) || 3001,
  appUrl,
  gommo: {
    baseUrl: process.env.GOMMO_API_BASE_URL || process.env.GOMMO_BASE_URL || 'https://v2.api.gommo.net',
    authBaseUrl: process.env.GOMMO_AUTH_BASE_URL || 'https://api.gommo.net',
    authPath: process.env.GOMMO_AUTH_PATH || '/api/apps/go-mmo',
    accessToken: (process.env.GOMMO_ACCESS_TOKEN || '').trim(),
    apiDomain: (process.env.GOMMO_API_DOMAIN || 'vmedia.ai').trim(),
  },
  topup: {
    minVnd: Number(process.env.TOPUP_MIN_VND) || 10_000,
    maxVnd: Number(process.env.TOPUP_MAX_VND) || 20_000_000,
    creditsPerVnd: Number(process.env.TOPUP_CREDITS_PER_VND) || 1,
    ordersFile: process.env.TOPUP_ORDERS_FILE || path.join(process.cwd(), 'data', 'topup-orders.json'),
  },
  payos: {
    clientId: (process.env.PAYOS_CLIENT_ID || '').trim().replace(/\r/g, ''),
    apiKey: (process.env.PAYOS_API_KEY || '').trim().replace(/\r/g, ''),
    checksumKey: (process.env.PAYOS_CHECKSUM_KEY || '').trim().replace(/\r/g, ''),
    webhookUrl: (process.env.PAYOS_WEBHOOK_URL || '').trim().replace(/\r/g, ''),
    returnUrl: `${appUrl}/pricing`,
    cancelUrl: `${appUrl}/pricing`,
    planReturnUrl: `${appUrl}/pricing`,
    planCancelUrl: `${appUrl}/pricing`,
    apiBaseUrl: 'https://api-merchant.payos.vn',
  },
};

export function isPayOsConfigured(): boolean {
  return Boolean(config.payos.clientId && config.payos.apiKey && config.payos.checksumKey);
}

export function isGommoMerchantConfigured(): boolean {
  return Boolean(config.gommo.accessToken && config.gommo.apiDomain);
}

export function vndToCredits(amountVnd: number): number {
  const rate = config.topup.creditsPerVnd;
  return Math.floor(amountVnd * rate);
}
