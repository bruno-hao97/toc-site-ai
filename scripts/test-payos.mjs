import 'dotenv/config';
import { createHmac } from 'node:crypto';

const checksumKey = (process.env.PAYOS_CHECKSUM_KEY || '').trim().replace(/\r/g, '');
const clientId = (process.env.PAYOS_CLIENT_ID || '').trim().replace(/\r/g, '');
const apiKey = (process.env.PAYOS_API_KEY || '').trim().replace(/\r/g, '');

const orderCode = Number(String(Date.now()).slice(-9));
const amount = 2000;
const description = `DH${String(orderCode).slice(-7)}`.slice(0, 9);
const returnUrl = 'http://localhost:5173/pricing';
const cancelUrl = 'http://localhost:5173/pricing';

const payload = `amount=${amount}&cancelUrl=${cancelUrl}&description=${description}&orderCode=${orderCode}&returnUrl=${returnUrl}`;
const signature = createHmac('sha256', checksumKey).update(payload).digest('hex');

console.log('payload:', payload);
console.log('signature:', signature);
console.log('keyLens:', clientId.length, apiKey.length, checksumKey.length);

const res = await fetch('https://api-merchant.payos.vn/v2/payment-requests', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-client-id': clientId,
    'x-api-key': apiKey,
  },
  body: JSON.stringify({ orderCode, amount, description, returnUrl, cancelUrl, signature }),
});

const raw = await res.json();
console.log('status:', res.status);
console.log(JSON.stringify(raw, null, 2));
