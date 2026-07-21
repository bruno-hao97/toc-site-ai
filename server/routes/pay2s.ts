import { Router } from 'express';
import {
  createPay2sPayment,
  createTopupPay2sPayment,
  verifyPay2sIpnSignature,
  verifyPay2sKeys,
} from '../services/pay2s.js';
import { fulfillTopupFromPay2sIpn } from '../services/topupFulfillment.js';
import { createTopupOrder, getTopupOrder } from '../services/topupOrders.js';
import { CREDIT_PACKAGES, getCreditPackage } from '../services/creditPackages.js';
import { config, isGommoMerchantConfigured, isPay2sConfigured } from '../config.js';

const router = Router();

router.get('/status', async (_req, res) => {
  const configured = isPay2sConfigured();
  const verify = configured ? await verifyPay2sKeys() : { ok: false, message: 'Thiếu Pay2S key trong .env' };
  res.json({
    success: true,
    data: {
      configured,
      valid: verify.ok,
      message: verify.message,
      redirectUrl: config.pay2s.redirectUrl,
      ipnUrl: config.pay2s.ipnUrl || null,
      apiCreateUrl: config.pay2s.apiCreateUrl,
      bankId: config.pay2s.bankId || null,
      bankAccountMasked: config.pay2s.bankAccountNumber
        ? `${config.pay2s.bankAccountNumber.slice(0, 2)}****${config.pay2s.bankAccountNumber.slice(-2)}`
        : null,
      merchantReady: isGommoMerchantConfigured(),
      topup: {
        minVnd: config.topup.minVnd,
        maxVnd: config.topup.maxVnd,
        creditsPerVnd: config.topup.creditsPerVnd,
      },
    },
  });
});

router.post('/payment-requests', async (req, res) => {
  try {
    const planId = String(req.body?.planId || '').trim();
    const planName = String(req.body?.planName || 'Gói đăng ký').trim();
    const amount = Number(req.body?.amount);

    if (!planId) {
      res.status(400).json({ success: false, message: 'Thiếu planId' });
      return;
    }
    if (!isPay2sConfigured()) {
      res.status(503).json({ success: false, message: 'Pay2S chưa cấu hình trên server' });
      return;
    }

    const payment = await createPay2sPayment({ planId, planName, amount });
    res.json({ success: true, data: payment });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message });
  }
});

router.get('/credit-packages', (_req, res) => {
  res.json({ success: true, data: CREDIT_PACKAGES });
});

router.post('/topup-requests', async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const packageId = String(req.body?.packageId || '').trim();
    const creditPackage = getCreditPackage(packageId);

    if (!username) {
      res.status(400).json({ success: false, message: 'Thiếu username' });
      return;
    }
    if (!creditPackage) {
      res.status(400).json({ success: false, message: 'Gói credit không hợp lệ' });
      return;
    }
    if (!isPay2sConfigured()) {
      res.status(503).json({ success: false, message: 'Pay2S chưa cấu hình trên server' });
      return;
    }

    const payment = await createTopupPay2sPayment({
      username,
      amountVnd: creditPackage.amountVnd,
    });
    const order = await createTopupOrder({
      orderCode: payment.orderCode,
      username,
      packageId: creditPackage.id,
      amountVnd: creditPackage.amountVnd,
      credits: creditPackage.credits,
    });

    res.json({
      success: true,
      data: {
        ...payment,
        username,
        packageId: creditPackage.id,
        credits: creditPackage.credits,
        order,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message });
  }
});

router.get('/topup-orders/:orderCode', async (req, res) => {
  try {
    const orderCode = Number(req.params.orderCode);
    if (!Number.isFinite(orderCode)) {
      res.status(400).json({ success: false, message: 'orderCode không hợp lệ' });
      return;
    }
    const order = await getTopupOrder(orderCode);
    if (!order) {
      res.status(404).json({ success: false, message: 'Không tìm thấy đơn' });
      return;
    }
    res.json({ success: true, data: order });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message });
  }
});

/** Pay2S / trình duyệt có thể GET để kiểm tra URL — phải trả 200. */
router.get('/ipn', (_req, res) => {
  res.json({ success: true, message: 'Pay2S IPN endpoint ready' });
});

router.post('/ipn', async (req, res) => {
  try {
    const body = (req.body || {}) as Record<string, unknown>;

    if (!verifyPay2sIpnSignature(body)) {
      console.warn('[pay2s/ipn] invalid signature');
      res.status(200).json({ success: false, message: 'ERROR! Fail checksum' });
      return;
    }

    const result = await fulfillTopupFromPay2sIpn(body);
    if (!result.ok) {
      console.error('[pay2s/ipn]', result.message, result.orderCode ?? '');
    } else {
      console.log('[pay2s/ipn]', result.message);
    }

    res.status(200).json({ success: true, message: result.message });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[pay2s/ipn] unhandled', message);
    res.status(200).json({ success: false, message });
  }
});

/** Alias webhook path (tương đương /ipn). */
router.get('/webhook', (_req, res) => {
  res.json({ success: true, message: 'Pay2S IPN endpoint ready' });
});

router.post('/webhook', async (req, res) => {
  try {
    const body = (req.body || {}) as Record<string, unknown>;

    if (!verifyPay2sIpnSignature(body)) {
      console.warn('[pay2s/webhook] invalid signature');
      res.status(200).json({ success: false, message: 'ERROR! Fail checksum' });
      return;
    }

    const result = await fulfillTopupFromPay2sIpn(body);
    console.log('[pay2s/webhook]', result.message);
    res.status(200).json({ success: true, message: result.message });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[pay2s/webhook] unhandled', message);
    res.status(200).json({ success: false, message });
  }
});

export default router;
