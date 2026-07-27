import { Router, type Request, type Response } from 'express';
import {
  createPay2sPayment,
  createTopupPay2sPayment,
  isPay2sBankWebhookPayload,
  verifyPay2sIpnSignature,
  verifyPay2sKeys,
  verifyPay2sWebhookBearer,
} from '../services/pay2s.js';
import {
  fulfillTopupFromPay2sBankWebhook,
  fulfillTopupFromPay2sIpn,
} from '../services/topupFulfillment.js';
import { createTopupOrder, getTopupOrder } from '../services/topupOrders.js';
import { CREDIT_PACKAGES, getCreditPackage } from '../services/creditPackages.js';
import {
  assertTopupWalletsCanCover,
  MerchantBalanceError,
} from '../services/topupCapacity.js';
import {
  config,
  isGommoMerchantConfigured,
  isPay2sConfigured,
  isPayQrEnabled,
  PAY_QR_DISABLED_MESSAGE,
} from '../config.js';

const router = Router();

router.get('/status', async (_req, res) => {
  const configured = isPay2sConfigured();
  const verify = configured ? await verifyPay2sKeys() : { ok: false, message: 'Thiếu Pay2S key trong .env' };
  const qrEnabled = isPayQrEnabled();
  res.json({
    success: true,
    data: {
      configured,
      valid: verify.ok,
      message: verify.message,
      qrEnabled,
      qrDisabledMessage: qrEnabled ? null : PAY_QR_DISABLED_MESSAGE,
      webhookTokenConfigured: Boolean(config.pay2s.webhookToken),
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
    if (!isPayQrEnabled()) {
      res.status(503).json({ success: false, message: PAY_QR_DISABLED_MESSAGE });
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
    if (!isPayQrEnabled()) {
      res.status(503).json({ success: false, message: PAY_QR_DISABLED_MESSAGE });
      return;
    }
    if (!isPay2sConfigured()) {
      res.status(503).json({ success: false, message: 'Pay2S chưa cấu hình trên server' });
      return;
    }

    // Check 2 ví TRƯỚC khi tạo QR — tránh user CK rồi không cộng được credit
    try {
      await assertTopupWalletsCanCover(creditPackage.credits);
    } catch (err) {
      if (err instanceof MerchantBalanceError) {
        res.status(503).json({ success: false, message: err.message });
        return;
      }
      throw err;
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
    if (err instanceof MerchantBalanceError) {
      res.status(503).json({ success: false, message: err.message });
      return;
    }
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

async function handlePay2sNotify(req: Request, res: Response, logPrefix: string): Promise<void> {
  const body = (req.body || {}) as Record<string, unknown>;

  // Dashboard webhook "Tiền vào" — Bearer token + transactions[]
  if (isPay2sBankWebhookPayload(body)) {
    const auth = String(req.headers.authorization || '');
    if (!config.pay2s.webhookToken) {
      console.warn(`[${logPrefix}] bank webhook: thiếu PAY2S_WEBHOOK_TOKEN trong .env`);
      res.status(503).json({ success: false, message: 'PAY2S_WEBHOOK_TOKEN chưa cấu hình' });
      return;
    }
    if (!verifyPay2sWebhookBearer(auth)) {
      console.warn(`[${logPrefix}] bank webhook: invalid Bearer token`);
      res.status(403).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const result = await fulfillTopupFromPay2sBankWebhook(body);
    console.log(`[${logPrefix}]`, result.message);
    res.status(200).json({ success: true, message: result.message });
    return;
  }

  // Payment gateway IPN — m2signature
  if (!verifyPay2sIpnSignature(body)) {
    console.warn(`[${logPrefix}] invalid signature`);
    res.status(200).json({ success: false, message: 'ERROR! Fail checksum' });
    return;
  }

  const result = await fulfillTopupFromPay2sIpn(body);
  if (!result.ok) {
    console.error(`[${logPrefix}]`, result.message, result.orderCode ?? '');
  } else {
    console.log(`[${logPrefix}]`, result.message);
  }
  res.status(200).json({ success: true, message: result.message });
}

router.post('/ipn', async (req, res) => {
  try {
    await handlePay2sNotify(req, res, 'pay2s/ipn');
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
    await handlePay2sNotify(req, res, 'pay2s/webhook');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[pay2s/webhook] unhandled', message);
    res.status(200).json({ success: false, message });
  }
});

export default router;
