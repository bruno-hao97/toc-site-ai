import express, { Router } from 'express';
import { Readable } from 'node:stream';
import { config } from '../config.js';
import { AuthError, getUserFromAuthHeader } from '../services/platformAuth.js';

const router = Router();

const rawBody = express.raw({ type: () => true, limit: '50mb' });

/** Không forward — hop-by-hop hoặc sẽ set lại khi buffer body. */
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
  'content-encoding', // fetch đã giải nén body — giữ header gzip làm browser lỗi parse
]);

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
  let path = originalUrl;
  if (stripPrefix && path.startsWith(stripPrefix)) {
    path = path.slice(stripPrefix.length) || '/';
  }
  if (!path.startsWith('/')) path = `/${path}`;
  return `${upstreamBase.replace(/\/$/, '')}${path}`;
}

function shouldStreamResponse(req: express.Request, contentType: string): boolean {
  if (contentType.includes('text/event-stream')) return true;
  return req.originalUrl.includes('/chat');
}

async function proxyPass(
  req: express.Request,
  res: express.Response,
  upstreamBase: string,
  stripPrefix?: string,
): Promise<void> {
  const rawUrl = buildUpstreamUrl(upstreamBase, req.originalUrl, stripPrefix);
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';

  try {
    if (!config.gommo.accessToken) {
      res.status(503).json({ success: false, message: 'Chưa cấu hình token admin trên server' });
      return;
    }
    await getUserFromAuthHeader(
      typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined,
    );

    const urlObj = new URL(rawUrl);
    urlObj.searchParams.set('access_token', config.gommo.accessToken);
    urlObj.searchParams.set('domain', config.gommo.apiDomain);

    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    let body: Buffer | undefined;
    if (hasBody) {
      const raw = req.body as Buffer;
      if (contentType.includes('application/x-www-form-urlencoded')) {
        const form = new URLSearchParams(raw?.toString('utf8') || '');
        form.set('access_token', config.gommo.accessToken);
        form.set('domain', config.gommo.apiDomain);
        body = Buffer.from(form.toString());
      } else if (contentType.includes('application/json')) {
        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(raw?.toString('utf8') || '{}') as Record<string, unknown>;
        } catch {
          // Upstream nhận object rỗng thay vì body JSON lỗi.
        }
        parsed.access_token = config.gommo.accessToken;
        parsed.domain = config.gommo.apiDomain;
        body = Buffer.from(JSON.stringify(parsed));
      } else if (contentType.includes('multipart/form-data')) {
        res.status(400).json({ success: false, message: 'Upload phải đi qua endpoint platform' });
        return;
      } else if (raw?.length) {
        res.status(415).json({ success: false, message: 'Content-Type không được hỗ trợ' });
        return;
      }
    }

    const headers = upstreamHeaders(req, body);
    headers.authorization = `Bearer ${config.gommo.accessToken}`;
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

/** Pass-through proxy che URL Gommo — giữ nguyên method/body/header/payload. */
mountProxy('/v2', config.gommo.baseUrl, '/v2');
mountProxy('/ai', config.gommo.authBaseUrl);
mountProxy('/api/v2', config.gommo.authBaseUrl);
mountProxy(config.gommo.authPath, config.gommo.authBaseUrl);

export default router;
