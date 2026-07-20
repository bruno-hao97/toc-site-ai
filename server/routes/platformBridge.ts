import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import {
  extractProviderJobId,
  extractResultUrl,
  extractStatus,
  resolveJobCost,
} from '../services/gommoEnvelope.js';
import { gommoAdminPostForm } from '../services/gommoAdminClient.js';
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

async function fetchBridgeUser(auth: string): Promise<{ id: string; credits: number }> {
  const res = await fetch(`${bridgeBase()}/me.php`, {
    headers: { Authorization: auth, Accept: 'application/json' },
  });
  const parsed = (await res.json()) as {
    success?: boolean;
    message?: string;
    data?: { user?: { id?: string; credits?: number } };
  };
  if (!res.ok || !parsed.success || !parsed.data?.user?.id) {
    throw new Error(parsed.message || 'Token không hợp lệ');
  }
  return {
    id: String(parsed.data.user.id),
    credits: Number(parsed.data.user.credits ?? 0),
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
    if (user.credits < cost) {
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
        credits: Math.max(0, user.credits - cost),
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

export default router;
