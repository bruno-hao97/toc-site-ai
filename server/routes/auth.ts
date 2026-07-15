import { Router } from 'express';
import { config } from '../config.js';
import {
  AuthError,
  getUserFromAuthHeader,
  loginUser,
  registerUser,
} from '../services/platformAuth.js';
import { isDatabaseConfigured } from '../db/pool.js';

const router = Router();

async function forwardToBridge(
  req: import('express').Request,
  res: import('express').Response,
  path: string,
  method: 'GET' | 'POST',
) {
  const base = config.auth.bridgeUrl.replace(/\/$/, '');
  const url = `${base}/${path}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
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

function requireLocalDb(
  _req: unknown,
  res: import('express').Response,
  next: import('express').NextFunction,
) {
  if (!isDatabaseConfigured()) {
    res.status(503).json({ success: false, message: 'Database chưa cấu hình trên server' });
    return;
  }
  next();
}

router.post('/register', async (req, res) => {
  try {
    if (config.auth.bridgeUrl) {
      await forwardToBridge(req, res, 'register.php', 'POST');
      return;
    }
    requireLocalDb(req, res, () => undefined);
    if (res.headersSent) return;

    const result = await registerUser({
      email: String(req.body?.email || ''),
      password: String(req.body?.password || ''),
      phone: req.body?.phone ? String(req.body.phone) : undefined,
      name: req.body?.name ? String(req.body.name) : undefined,
    });
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ success: false, message: err.message });
      return;
    }
    console.error('[auth/register]', err);
    res.status(500).json({ success: false, message: 'Đăng ký thất bại' });
  }
});

router.post('/login', async (req, res) => {
  try {
    if (config.auth.bridgeUrl) {
      await forwardToBridge(req, res, 'login.php', 'POST');
      return;
    }
    if (!isDatabaseConfigured()) {
      res.status(503).json({ success: false, message: 'Database chưa cấu hình trên server' });
      return;
    }

    const result = await loginUser({
      email: String(req.body?.email || ''),
      password: String(req.body?.password || ''),
    });
    res.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ success: false, message: err.message });
      return;
    }
    console.error('[auth/login]', err);
    res.status(500).json({ success: false, message: 'Đăng nhập thất bại' });
  }
});

router.get('/me', async (req, res) => {
  try {
    if (config.auth.bridgeUrl) {
      await forwardToBridge(req, res, 'me.php', 'GET');
      return;
    }
    if (!isDatabaseConfigured()) {
      res.status(503).json({ success: false, message: 'Database chưa cấu hình trên server' });
      return;
    }

    const user = await getUserFromAuthHeader(req.headers.authorization);
    res.json({ success: true, data: { user } });
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ success: false, message: err.message });
      return;
    }
    console.error('[auth/me]', err);
    res.status(500).json({ success: false, message: 'Không lấy được thông tin user' });
  }
});

export default router;
