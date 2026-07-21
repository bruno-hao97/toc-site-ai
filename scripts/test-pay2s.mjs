import 'dotenv/config';
import crypto from 'node:crypto';

const partnerCode = (process.env.PAY2S_PARTNER_CODE || '').trim();
const accessKey = (process.env.PAY2S_ACCESS_KEY || '').trim();
const secretKey = (process.env.PAY2S_SECRET_KEY || '').trim();
const bankAccount = (process.env.PAY2S_BANK_ACCOUNT || '99999999').trim();
const bankId = (process.env.PAY2S_BANK_ID || 'ACB').trim();
const sandbox = process.env.PAY2S_SANDBOX === '1' || process.env.PAY2S_SANDBOX === 'true';
const endpoint =
  (process.env.PAY2S_API_CREATE_URL || '').trim() ||
  (sandbox
    ? 'https://sandbox-payment.pay2s.vn/v1/gateway/api/create'
    : 'https://payment.pay2s.vn/v1/gateway/api/create');
const redirectUrl = (process.env.PAY2S_REDIRECT_URL || 'http://localhost:5173/pricing').trim();
const ipnUrl = (process.env.PAY2S_IPN_URL || 'https://pro.agi.vn/api/pay2s/ipn').trim();

if (!partnerCode || !accessKey || !secretKey) {
  console.error('FAILED: thiếu PAY2S_PARTNER_CODE / ACCESS_KEY / SECRET_KEY trong .env');
  process.exit(1);
}

const orderId = String(Date.now()).slice(-12);
const requestId = `${orderId}01`;
const amount = '2000';
const orderInfo = `TOPUP${orderId}`.slice(0, 32);
const requestType = 'pay2s';

const rawHash =
  `accessKey=${accessKey}` +
  `&amount=${amount}` +
  `&bankAccounts=Array` +
  `&ipnUrl=${ipnUrl}` +
  `&orderId=${orderId}` +
  `&orderInfo=${orderInfo}` +
  `&partnerCode=${partnerCode}` +
  `&redirectUrl=${redirectUrl}` +
  `&requestId=${requestId}` +
  `&requestType=${requestType}`;

const signature = crypto.createHmac('sha256', secretKey).update(rawHash).digest('hex');

const body = {
  accessKey,
  partnerCode,
  partnerName: process.env.PAY2S_PARTNER_NAME || 'LN AI',
  requestId,
  amount: Number(amount),
  orderId,
  orderInfo,
  orderType: requestType,
  bankAccounts: [{ account_number: bankAccount, bank_id: bankId }],
  redirectUrl,
  ipnUrl,
  requestType,
  lang: 'vi',
  signature,
};

console.log('POST', endpoint);
const res = await fetch(endpoint, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=UTF-8' },
  body: JSON.stringify(body),
});
const text = await res.text();
let data;
try {
  data = JSON.parse(text);
} catch {
  console.error('FAILED: non-JSON', text);
  process.exit(1);
}

if (Number(data.resultCode) === 0) {
  console.log('SUCCESS');
  console.log(
    JSON.stringify(
      {
        resultCode: data.resultCode,
        message: data.message,
        orderId: data.orderId,
        payUrl: data.payUrl,
        qrCount: Array.isArray(data.qrList) ? data.qrList.length : 0,
        account: data.qrList?.[0]?.account_number,
        bank: data.qrList?.[0]?.bank_id,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

console.error('FAILED');
console.error(JSON.stringify(data, null, 2));
process.exit(1);
