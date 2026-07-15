import 'dotenv/config';
import { PayOS } from '@payos/node';

const payos = new PayOS({
  clientId: (process.env.PAYOS_CLIENT_ID || '').trim(),
  apiKey: (process.env.PAYOS_API_KEY || '').trim(),
  checksumKey: (process.env.PAYOS_CHECKSUM_KEY || '').trim(),
});

const orderCode = Number(String(Date.now()).slice(-9));

try {
  const paymentLink = await payos.paymentRequests.create({
    orderCode,
    amount: 2000,
    description: `DH${String(orderCode).slice(-7)}`.slice(0, 9),
    returnUrl: 'http://localhost:5173/pricing',
    cancelUrl: 'http://localhost:5173/pricing',
  });
  console.log('SUCCESS');
  console.log(JSON.stringify(paymentLink, null, 2));
} catch (err) {
  console.error('FAILED');
  console.error(err);
}
