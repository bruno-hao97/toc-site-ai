import { Router } from 'express';
import { config } from '../config.js';

const router = Router();

async function forwardToBridge(
  req: import('express').Request,
  res: import('express').Response,
  path: string,
) {
  if (!config.auth.bridgeUrl) {
    res.status(503).json({
      success: false,
      message: 'AUTH_BRIDGE_URL chưa cấu hình — không chuyển credit được',
    });
    return;
  }

  const base = config.auth.bridgeUrl.replace(/\/$/, '');
  const url = `${base}/${path}`;
  const upstream = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(req.headers.authorization
        ? { Authorization: String(req.headers.authorization) }
        : {}),
    },
    body: JSON.stringify(req.body ?? {}),
  });
  const text = await upstream.text();
  res.status(upstream.status);
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
  res.send(text);
}

/** User → user (trừ ví người gửi) */
router.post('/transfer', async (req, res) => {
  try {
    await forwardToBridge(req, res, 'transfer.php');
  } catch (err) {
    console.error('[credits/transfer]', err);
    res.status(500).json({ success: false, message: 'Chuyển credit thất bại' });
  }
});

/** Admin → user (cấp từ quỹ, không trừ ví admin) */
router.post('/grant', async (req, res) => {
  try {
    await forwardToBridge(req, res, 'grant.php');
  } catch (err) {
    console.error('[credits/grant]', err);
    res.status(500).json({ success: false, message: 'Cấp credit thất bại' });
  }
});

export default router;
