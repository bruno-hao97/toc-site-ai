import { Router } from 'express';
import {
  createPayOsPayment,
  createTopupPayOsPayment,
  verifyPayOsKeys,
  verifyPayOsWebhookSignature,
} from '../services/payos.js';
import { fulfillTopupFromWebhook } from '../services/topupFulfillment.js';
import { createTopupOrder, getTopupOrder } from '../services/topupOrders.js';
import { CREDIT_PACKAGES, getCreditPackage } from '../services/creditPackages.js';
import { config, isGommoMerchantConfigured, isPayOsConfigured } from '../config.js';

const router = Router();

router.get('/status', async (_req, res) => {
  const configured = isPayOsConfigured();
  const verify = configured ? await verifyPayOsKeys() : { ok: false, message: 'Thiếu PayOS key trong .env' };
  res.json({
    success: true,
    data: {
      configured,
      valid: verify.ok,
      message: verify.message,
      returnUrl: config.payos.returnUrl,
      webhookUrl: config.payos.webhookUrl || null,
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

    const payment = await createPayOsPayment({ planId, planName, amount });
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
    if (!isPayOsConfigured()) {
      res.status(503).json({ success: false, message: 'PayOS chưa cấu hình trên server' });
      return;
    }

    const payment = await createTopupPayOsPayment({
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

/** PayOS / trình duyệt có thể GET để kiểm tra URL — phải trả 200. */
router.get('/webhook', (_req, res) => {
  res.json({ success: true, message: 'PayOS webhook endpoint ready' });
});

router.post('/webhook', async (req, res) => {
  try {
    const body = (req.body || {}) as Record<string, unknown>;
    const signature = String(body.signature || req.headers['x-payos-signature'] || '');

    if (!verifyPayOsWebhookSignature(body, signature)) {
      console.warn('[payos/webhook] invalid signature');
      res.status(400).json({ success: false, message: 'Invalid PayOS signature' });
      return;
    }

    const result = await fulfillTopupFromWebhook(body);
    if (!result.ok) {
      console.error('[payos/webhook]', result.message, result.orderCode ?? '');
    } else {
      console.log('[payos/webhook]', result.message);
    }

    // PayOS yêu cầu HTTP 200 khi verify URL + nhận webhook (kể cả ping test).
    res.json({ success: true, message: result.message });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[payos/webhook] unhandled', message);
    res.status(500).json({ success: false, message });
  }
});

export default router;
