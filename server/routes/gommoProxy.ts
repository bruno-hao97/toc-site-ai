import express, { Router } from 'express';
import { Readable } from 'node:stream';
import fs from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { AuthError } from '../services/platformAuth.js';
import { getGommoAdminToken } from '../services/gommoAdminClient.js';

const router = Router();

const rawBody = express.raw({ type: () => true, limit: '50mb' });

const SKIP_RESPONSE_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
  'content-encoding',
]);

function readPhpJwtSecret(): string {
  try {
    const filePath = path.join(process.cwd(), 'server', 'php-bridge', 'config.local.php');
    const text = fs.readFileSync(filePath, 'utf8');
    return text.match(/'jwt_secret'\s*=>\s*'([^']*)'/)?.[1]?.trim() || '';
  } catch {
    return '';
  }
}

function readPhpDomain(): string {
  try {
    const filePath = path.join(process.cwd(), 'server', 'php-bridge', 'config.local.php');
    const text = fs.readFileSync(filePath, 'utf8');
    return text.match(/'gommo_domain'\s*=>\s*'([^']*)'/)?.[1]?.trim() || '';
  } catch {
    return '';
  }
}

/** JWT platform (HS256) — thử JWT_SECRET local rồi jwt_secret PHP bridge. */
function isPlatformJwt(token: string): boolean {
  if (!token || token.split('.').length !== 3) return false;
  const secrets = [config.jwt.secret, readPhpJwtSecret()].filter(Boolean);
  for (const secret of secrets) {
    try {
      jwt.verify(token, secret);
      return true;
    } catch {
      // thử secret tiếp theo
    }
  }
  return false;
}

function bearerFromReq(req: express.Request): string {
  const raw = req.headers.authorization;
  if (typeof raw !== 'string') return '';
  const m = raw.match(/^Bearer\s+(\S+)/i);
  return m?.[1]?.trim() || '';
}

function upstreamHeaders(req: express.Request, body?: Buffer): Record<string, string> {
  const out: Record<string, string> = {
    accept: 'application/json, text/event-stream',
    'accept-encoding': 'identity',
  };
  const contentType = req.headers['content-type'];
  if (typeof contentType === 'string') out['content-type'] = contentType;
  if (body?.length) out['content-length'] = String(body.length);
  return out;
}

function copyUpstreamHeaders(upstream: Response, res: express.Response): void {
  upstream.headers.forEach((value, key) => {
    if (!SKIP_RESPONSE_HEADERS.has(key.toLowerCase())) {
      res.setHeader(key, value);
    }
  });
}

function buildUpstreamUrl(upstreamBase: string, originalUrl: string, stripPrefix?: string): string {
  let p = originalUrl;
  if (stripPrefix && p.startsWith(stripPrefix)) {
    p = p.slice(stripPrefix.length) || '/';
  }
  if (!p.startsWith('/')) p = `/${p}`;
  return `${upstreamBase.replace(/\/$/, '')}${p}`;
}

function shouldStreamResponse(req: express.Request, contentType: string): boolean {
  if (contentType.includes('text/event-stream')) return true;
  return req.originalUrl.includes('/chat');
}

/**
 * Hai chế độ:
 * 1) Bearer = JWT platform → thay bằng token admin.
 * 2) Bearer = Gommo access_token → passthrough token user.
 */
async function proxyPass(
  req: express.Request,
  res: express.Response,
  upstreamBase: string,
  stripPrefix?: string,
): Promise<void> {
  const rawUrl = buildUpstreamUrl(upstreamBase, req.originalUrl, stripPrefix);
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const bearer = bearerFromReq(req);

  try {
    const useAdmin = isPlatformJwt(bearer);
    const domain = config.gommo.apiDomain || readPhpDomain() || 'vmedia.ai';
    let gommoToken = '';

    if (useAdmin) {
      gommoToken = getGommoAdminToken() || config.gommo.accessToken;
      if (!gommoToken) {
        res.status(503).json({ success: false, message: 'Chưa cấu hình token admin trên server' });
        return;
      }
    } else if (bearer) {
      gommoToken = bearer;
    } else {
      res.status(401).json({ success: false, message: 'Thiếu token đăng nhập' });
      return;
    }

    const urlObj = new URL(rawUrl);
    if (useAdmin) {
      urlObj.searchParams.set('access_token', gommoToken);
      urlObj.searchParams.set('domain', domain);
    }

    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    let body: Buffer | undefined;
    if (hasBody) {
      const raw = req.body as Buffer;
      if (contentType.includes('application/x-www-form-urlencoded')) {
        const form = new URLSearchParams(raw?.toString('utf8') || '');
        if (useAdmin) {
          form.set('access_token', gommoToken);
          form.set('domain', domain);
        } else if (!form.get('access_token')) {
          form.set('access_token', gommoToken);
        }
        if (!form.get('domain') && domain) form.set('domain', domain);
        body = Buffer.from(form.toString());
      } else if (contentType.includes('application/json')) {
        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(raw?.toString('utf8') || '{}') as Record<string, unknown>;
        } catch {
          // ignore
        }
        if (useAdmin) {
          parsed.access_token = gommoToken;
          parsed.domain = domain;
        } else if (!parsed.access_token) {
          parsed.access_token = gommoToken;
        }
        if (!parsed.domain && domain) parsed.domain = domain;
        body = Buffer.from(JSON.stringify(parsed));
      } else if (contentType.includes('multipart/form-data')) {
        if (useAdmin) {
          res.status(400).json({ success: false, message: 'Upload phải đi qua endpoint platform' });
          return;
        }
        body = raw;
      } else if (raw?.length) {
        res.status(415).json({ success: false, message: 'Content-Type không được hỗ trợ' });
        return;
      }
    }

    const headers = upstreamHeaders(req, body);
    headers.authorization = `Bearer ${gommoToken}`;
    const upstream = await fetch(urlObj.toString(), {
      method: req.method,
      headers,
      body,
    });

    const responseContentType = upstream.headers.get('content-type') ?? '';
    res.status(upstream.status);
    copyUpstreamHeaders(upstream, res);

    if (shouldStreamResponse(req, responseContentType) && upstream.body) {
      const stream = Readable.fromWeb(upstream.body as import('stream/web').ReadableStream);
      stream.on('error', () => {
        if (!res.headersSent) res.status(502).end();
        else res.destroy();
      });
      res.on('close', () => stream.destroy());
      stream.pipe(res);
      return;
    }

    const payload = Buffer.from(await upstream.arrayBuffer());
    res.send(payload);
  } catch (err) {
    if (res.headersSent) return;
    if (err instanceof AuthError) {
      res.status(err.status).json({ success: false, message: err.message });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error('[gommo-proxy]', req.method, req.originalUrl, '→', message);
    res.status(502).json({ success: false, message: message || 'Upstream proxy error' });
  }
}

function mountProxy(mountPath: string, upstreamBase: string, stripPrefix?: string): void {
  router.use(mountPath, rawBody, (req, res) => {
    void proxyPass(req, res, upstreamBase, stripPrefix);
  });
}

const GW = '/api/platform/gw.php';

/** Frontend gọi qua gw.php — proxy local (tránh VPS gw.php cũ bắt JWT). */
mountProxy(`${GW}/v2`, config.gommo.baseUrl, `${GW}/v2`);
mountProxy(`${GW}/api/apps/go-mmo`, config.gommo.authBaseUrl, GW);
mountProxy(`${GW}/api/v2`, config.gommo.authBaseUrl, GW);
mountProxy(`${GW}/ai`, config.gommo.authBaseUrl, GW);

mountProxy('/v2', config.gommo.baseUrl, '/v2');
mountProxy('/ai', config.gommo.authBaseUrl);
mountProxy('/api/v2', config.gommo.authBaseUrl);
mountProxy(config.gommo.authPath, config.gommo.authBaseUrl);

export default router;
