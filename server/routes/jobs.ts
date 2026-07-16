import { Router } from 'express';
import { config } from '../config.js';

const router = Router();

async function forwardToBridge(
  req: import('express').Request,
  res: import('express').Response,
  path: string,
  method: 'GET' | 'POST' = 'POST',
) {
  if (!config.auth.bridgeUrl) {
    res.status(503).json({
      success: false,
      message: 'AUTH_BRIDGE_URL chưa cấu hình',
    });
    return;
  }

  const base = config.auth.bridgeUrl.replace(/\/$/, '');
  const url =
    method === 'GET' && Object.keys(req.query).length > 0
      ? `${base}/${path}?${new URLSearchParams(req.query as Record<string, string>).toString()}`
      : `${base}/${path}`;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (req.headers.authorization) {
    headers.Authorization = String(req.headers.authorization);
  }

  const init: RequestInit = { method, headers };
  if (method === 'POST') {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(req.body ?? {});
  }

  const upstream = await fetch(url, init);
  const text = await upstream.text();
  res.status(upstream.status);
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
  res.send(text);
}

router.get('/models', async (req, res) => {
  try {
    await forwardToBridge(req, res, 'job-models.php', 'GET');
  } catch (err) {
    console.error('[jobs/models]', err);
    res.status(500).json({ success: false, message: 'Không tải được models' });
  }
});

router.post('/create', async (req, res) => {
  try {
    await forwardToBridge(req, res, 'job-create.php', 'POST');
  } catch (err) {
    console.error('[jobs/create]', err);
    res.status(500).json({ success: false, message: 'Tạo job thất bại' });
  }
});

router.post('/poll', async (req, res) => {
  try {
    await forwardToBridge(req, res, 'job-poll.php', 'POST');
  } catch (err) {
    console.error('[jobs/poll]', err);
    res.status(500).json({ success: false, message: 'Poll job thất bại' });
  }
});

router.get('/list', async (req, res) => {
  try {
    await forwardToBridge(req, res, 'job-list.php', 'GET');
  } catch (err) {
    console.error('[jobs/list]', err);
    res.status(500).json({ success: false, message: 'Không tải được thư viện job' });
  }
});

router.post('/delete', async (req, res) => {
  try {
    await forwardToBridge(req, res, 'job-delete.php', 'POST');
  } catch (err) {
    console.error('[jobs/delete]', err);
    res.status(500).json({ success: false, message: 'Xóa job thất bại' });
  }
});

export default router;
