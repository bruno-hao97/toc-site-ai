import express, { Router } from 'express';
import { Readable } from 'node:stream';
import { config } from '../config.js';

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

const SKIP_REQUEST_HEADERS = new Set([
  'connection',
  'keep-alive',
  'host',
  'content-length',
  'transfer-encoding',
  'accept-encoding', // luôn gửi identity tới upstream
]);

function upstreamHeaders(req: express.Request, body?: Buffer): Record<string, string> {
  const out: Record<string, string> = { 'accept-encoding': 'identity' };
  for (const [key, value] of Object.entries(req.headers)) {
    const lower = key.toLowerCase();
    if (SKIP_REQUEST_HEADERS.has(lower)) continue;
    if (typeof value === 'string') out[key] = value;
    else if (Array.isArray(value)) out[key] = value.join(', ');
  }
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
  const url = buildUpstreamUrl(upstreamBase, req.originalUrl, stripPrefix);
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const bodyBuf = hasBody ? (req.body as Buffer) : undefined;
  const body = bodyBuf?.length ? bodyBuf : undefined;

  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers: upstreamHeaders(req, body),
      body,
    });

    const contentType = upstream.headers.get('content-type') ?? '';

    res.status(upstream.status);
    copyUpstreamHeaders(upstream, res);

    if (shouldStreamResponse(req, contentType) && upstream.body) {
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
