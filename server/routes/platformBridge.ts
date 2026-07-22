import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import {
  extractProviderJobId,
  extractResultUrl,
  extractStatus,
  resolveJobCost,
} from '../services/gommoEnvelope.js';
import { gommoAdminPostForm, getGommoAdminToken } from '../services/gommoAdminClient.js';
import { normalizeStoredJobStatus } from '../services/jobStatusHelpers.js';

const router = Router();
export const PLATFORM_JOB_BRIDGE_BUILD = '2026-07-20-node-dev-bridge';

function bridgeBase(): string {
  const base = config.auth.bridgeUrl.replace(/\/$/, '');
  if (!base) {
    throw new Error('AUTH_BRIDGE_URL chưa cấu hình');
  }
  return base;
}

function authHeader(req: import('express').Request): string {
  const raw = req.headers.authorization;
  if (typeof raw !== 'string' || !raw.startsWith('Bearer ')) {
    throw new Error('Thiếu token đăng nhập');
  }
  return raw;
}

async function fetchBridgeUser(auth: string): Promise<{ id: string; credits: number; isAdmin: boolean }> {
  const res = await fetch(`${bridgeBase()}/me.php`, {
    headers: { Authorization: auth, Accept: 'application/json' },
  });
  const parsed = (await res.json()) as {
    success?: boolean;
    message?: string;
    data?: { user?: { id?: string; credits?: number; isAdmin?: boolean } };
  };
  if (!res.ok || !parsed.success || !parsed.data?.user?.id) {
    throw new Error(parsed.message || 'Token không hợp lệ');
  }
  return {
    id: String(parsed.data.user.id),
    credits: Number(parsed.data.user.credits ?? 0),
    isAdmin: Boolean(parsed.data.user.isAdmin),
  };
}

router.get('/job-create.php', (req, res) => {
  if (req.query.probe !== '1') {
    res.status(405).json({
      success: false,
      message: 'Method not allowed',
      bridgeBuild: PLATFORM_JOB_BRIDGE_BUILD,
    });
    return;
  }
  res.json({
    success: true,
    data: {
      bridgeBuild: PLATFORM_JOB_BRIDGE_BUILD,
      normalize_stored_job_status: true,
      mode: 'node-dev-bridge',
    },
  });
});

router.post('/job-create.php', async (req, res) => {
  try {
    const auth = authHeader(req);
    const user = await fetchBridgeUser(auth);
    const type = String(req.body?.type ?? 'image').trim();
    const modelId = String(req.body?.modelId ?? req.body?.model_id ?? '').trim();
    const fields = (req.body?.fields ?? {}) as Record<string, unknown>;
    if (!type || !/^[a-z0-9-]+$/.test(type)) {
      res.status(400).json({ success: false, message: 'job type không hợp lệ' });
      return;
    }
    if (!modelId) {
      res.status(400).json({ success: false, message: 'Thiếu modelId' });
      return;
    }

    const cost = await resolveJobCost(bridgeBase(), auth, type, modelId, fields);
    if (cost < 1) {
      res.status(400).json({ success: false, message: 'Không xác định được giá model' });
      return;
    }
    // Admin dùng token merchant VMedia — không kiểm tra/trừ credit nội bộ platform.
    if (!user.isAdmin && user.credits < cost) {
      res.status(400).json({
        success: false,
        message: `Số dư credit không đủ (cần ${cost.toLocaleString('vi-VN')})`,
      });
      return;
    }

    const path = `/ai/jobs/${encodeURIComponent(type)}/${encodeURIComponent(modelId)}`;
    const envelope = await gommoAdminPostForm(path, fields);
    const providerJobId = extractProviderJobId(envelope);
    const resultUrl = extractResultUrl(envelope);
    normalizeStoredJobStatus(extractStatus(envelope), resultUrl);

    res.status(201).json({
      success: true,
      data: {
        platformJobId: randomUUID(),
        costCredits: cost,
        credits: user.isAdmin ? user.credits : Math.max(0, user.credits - cost),
        envelope,
        bridgeVersion: PLATFORM_JOB_BRIDGE_BUILD,
        devNote:
          'Local dev bridge: tạo job trực tiếp qua Gommo API + token admin. Upload job-create.php lên VPS để trừ credit + lưu lịch sử DB.',
      },
    });
  } catch (err) {
    console.error('[platformBridge/job-create]', err);
    res.status(500).json({
      success: false,
      message: `Tạo job thất bại: ${err instanceof Error ? err.message : 'Unknown error'}`,
      bridgeBuild: PLATFORM_JOB_BRIDGE_BUILD,
    });
  }
});

router.post('/job-poll.php', async (req, res) => {
  try {
    const auth = authHeader(req);
    await fetchBridgeUser(auth);
    const providerJobId = String(req.body?.providerJobId ?? '').trim();
    const media = String(req.body?.media ?? 'image').trim() || 'image';
    if (!providerJobId) {
      res.status(400).json({ success: false, message: 'Thiếu job id' });
      return;
    }

    const path = `/ai/jobs/${encodeURIComponent(providerJobId)}?media=${encodeURIComponent(media)}`;
    const envelope = await gommoAdminPostForm(path, {});

    res.json({
      success: true,
      data: {
        envelope,
        bridgeVersion: PLATFORM_JOB_BRIDGE_BUILD,
      },
    });
  } catch (err) {
    console.error('[platformBridge/job-poll]', err);
    res.status(500).json({
      success: false,
      message: `Poll job thất bại: ${err instanceof Error ? err.message : 'Unknown error'}`,
    });
  }
});

/** Đăng nhập Access Token — gọi Gommo /ai/me bằng token user (không cần JWT platform). */
router.post('/token-me.php', async (req, res) => {
  try {
    const accessToken = String(req.body?.access_token ?? '').trim();
    const domain = String(req.body?.domain ?? config.gommo.apiDomain ?? 'vmedia.ai').trim();
    if (!accessToken) {
      res.status(400).json({ success: false, message: 'Thiếu access_token' });
      return;
    }

    const authBase = (config.gommo.authBaseUrl || 'https://api.gommo.net').replace(/\/$/, '');
    const authPath = (config.gommo.authPath || '/api/apps/go-mmo').replace(/\/$/, '');
    const url = `${authBase}${authPath}/ai/me`;
    const body = new URLSearchParams({
      access_token: accessToken,
      domain,
    });

    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
    });

    const text = await upstream.text();
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      res.status(502).json({
        success: false,
        message: text.trimStart().startsWith('<!')
          ? 'Upstream trả HTML — kiểm tra token / mạng'
          : text.slice(0, 200) || `HTTP ${upstream.status}`,
      });
      return;
    }

    if (!upstream.ok || parsed.success === false) {
      res.status(upstream.status >= 400 ? upstream.status : 401).json({
        success: false,
        message: String(parsed.message || `HTTP ${upstream.status}`),
      });
      return;
    }

    const userInfo = (parsed.userInfo ?? {}) as Record<string, unknown>;
    if (!userInfo.id_base && !userInfo.email) {
      res.status(401).json({ success: false, message: 'Token hợp lệ nhưng thiếu userInfo' });
      return;
    }

    res.json({ success: true, data: parsed });
  } catch (err) {
    console.error('[platformBridge/token-me]', err);
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Xác thực token thất bại',
    });
  }
});

/** Admin — số dư credits_ai thật trên VMedia (token merchant server-side). */
router.get('/admin-vmedia-balance.php', async (req, res) => {
  try {
    const auth = authHeader(req);
    const user = await fetchBridgeUser(auth);
    if (!user.isAdmin) {
      res.status(403).json({ success: false, message: 'Chỉ admin được xem số dư VMedia thật' });
      return;
    }

    const token = getGommoAdminToken();
    if (!token) {
      res.status(503).json({ success: false, message: 'Chưa cấu hình GOMMO_ACCESS_TOKEN trên server' });
      return;
    }

    const domain = (config.gommo.apiDomain || 'vmedia.ai').trim();
    const authBase = (config.gommo.authBaseUrl || 'https://api.gommo.net').replace(/\/$/, '');
    const authPath = (config.gommo.authPath || '/api/apps/go-mmo').replace(/\/$/, '');
    const url = `${authBase}${authPath}/ai/me`;
    const body = new URLSearchParams({ access_token: token, domain });

    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
    });

    const text = await upstream.text();
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      res.status(502).json({
        success: false,
        message: text.trimStart().startsWith('<!')
          ? 'Upstream trả HTML — kiểm tra token admin / mạng'
          : text.slice(0, 200) || `HTTP ${upstream.status}`,
      });
      return;
    }

    if (!upstream.ok || parsed.success === false) {
      res.status(upstream.status >= 400 ? upstream.status : 502).json({
        success: false,
        message: String(parsed.message || `HTTP ${upstream.status}`),
      });
      return;
    }

    const balances = (parsed.balancesInfo ?? {}) as Record<string, unknown>;
    res.json({
      success: true,
      data: {
        credits_ai: Number(balances.credits_ai ?? 0),
        domain,
        updated_time:
          typeof balances.updated_time === 'number' ? balances.updated_time : null,
      },
    });
  } catch (err) {
    console.error('[platformBridge/admin-vmedia-balance]', err);
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Không lấy được số dư VMedia',
    });
  }
});

/** Tab "Của tôi" — proxy Gommo /ai/videos + /ai/images (local dev). */
router.get('/mine-media.php', async (req, res) => {
  try {
    const auth = authHeader(req);
    await fetchBridgeUser(auth);

    const type = String(req.query.type ?? 'video').trim();
    const limit = Math.max(1, Math.min(50, Number(req.query.limit ?? 30) || 30));
    const afterId = String(req.query.afterId ?? req.query.after_id ?? '').trim();

    if (type !== 'video' && type !== 'image') {
      res.status(400).json({ success: false, message: 'type phải là video hoặc image' });
      return;
    }

    const authBase = (config.gommo.authBaseUrl || 'https://api.gommo.net').replace(/\/$/, '');
    const authPath = (config.gommo.authPath || '/api/apps/go-mmo').replace(/\/$/, '');
    const path = type === 'video' ? `${authPath}/ai/videos` : `${authPath}/ai/images`;
    const fields: Record<string, unknown> = {
      limit: String(limit),
      order_by: 'index',
      sort_by: 'desc',
    };
    if (afterId) fields.after_id = afterId;

    const envelope = await gommoAdminPostForm(path, fields, authBase);
    res.json(envelope);
  } catch (err) {
    console.error('[platformBridge/mine-media]', err);
    res.status(500).json({
      success: false,
      message: `Không tải được thư viện: ${err instanceof Error ? err.message : 'Unknown error'}`,
    });
  }
});

export default router;
