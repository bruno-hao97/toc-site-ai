import {
  GommoClient,
  type GommoEnvelope,
  type GommoModel,
  type JobType,
  type PollMedia,
} from './api';
import { loadAuth, saveAuth } from './authStore';

/** GommoClient qua server — trừ credit platform + token admin VMedia. */
export class PlatformJobClient {
  domain = '79ai.net';
  projectId = 'default';
  accessToken = 'platform';

  private authHeaders(): Record<string, string> {
    const token = loadAuth()?.platform_token;
    if (!token) throw new Error('Chưa đăng nhập tài khoản hệ thống');
    return { Authorization: `Bearer ${token}` };
  }

  private async postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const res = await fetch(path, {
      method: 'POST',
      headers: {
        ...this.authHeaders(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: T & { success?: boolean; message?: string };
    try {
      parsed = JSON.parse(text) as T & { success?: boolean; message?: string };
    } catch {
      throw new Error(text || `HTTP ${res.status}`);
    }
    if (!res.ok || parsed.success === false) {
      throw new Error((parsed as { message?: string }).message || `HTTP ${res.status}`);
    }
    return parsed;
  }

  async fetchModels(type: JobType): Promise<GommoEnvelope> {
    if (type !== 'image') {
      throw new Error('Platform job proxy phase 1 chỉ hỗ trợ image');
    }
    const res = await fetch(`/api/jobs/models?type=${encodeURIComponent(type)}`, {
      headers: this.authHeaders(),
    });
    const text = await res.text();
    let parsed: { success?: boolean; message?: string; data?: GommoEnvelope };
    try {
      parsed = JSON.parse(text) as typeof parsed;
    } catch {
      throw new Error(text || `HTTP ${res.status}`);
    }
    if (!res.ok || !parsed.success || !parsed.data) {
      throw new Error(parsed.message || 'Không tải được models');
    }
    return parsed.data;
  }

  listModels(envelope: GommoEnvelope): GommoModel[] {
    return new GommoClient({ accessToken: 'x' }).listModels(envelope);
  }

  async createJob(
    type: JobType,
    modelId: string,
    fields: Record<string, unknown>,
  ): Promise<GommoEnvelope> {
    const parsed = await this.postJson<{
      data: { envelope: GommoEnvelope; credits?: number; platformJobId?: string };
    }>('/api/jobs/create', { type, modelId, fields });

    const auth = loadAuth();
    if (auth?.user && typeof parsed.data.credits === 'number') {
      saveAuth({ ...auth, user: { ...auth.user, credits: parsed.data.credits } });
    }

    const envelope = parsed.data.envelope;
    if (parsed.data.platformJobId && envelope.data && typeof envelope.data === 'object') {
      (envelope.data as Record<string, unknown>)._platformJobId = parsed.data.platformJobId;
    }
    return envelope;
  }

  async pollOnce(jobId: string, media: PollMedia): Promise<GommoEnvelope> {
    const parsed = await this.postJson<{ data: { envelope: GommoEnvelope } }>('/api/jobs/poll', {
      providerJobId: jobId,
      media,
    });
    return parsed.data.envelope;
  }

  async uploadImage(): Promise<{ url: string; envelope: GommoEnvelope }> {
    throw new Error('Upload ảnh qua platform chưa hỗ trợ — dùng text-to-image hoặc đăng nhập Token');
  }
}

export function usesPlatformJobs(): boolean {
  const auth = loadAuth();
  return Boolean(auth?.platform_token?.trim() && !auth?.access_token?.trim());
}

export function getJobClient(): GommoClient | PlatformJobClient {
  const auth = loadAuth();
  if (!auth) throw new Error('Chưa đăng nhập');
  if (auth.access_token?.trim()) {
    return new GommoClient({
      accessToken: auth.access_token,
      domain: auth.domain || '79ai.net',
      projectId: auth.projectId,
    });
  }
  if (auth.platform_token?.trim()) {
    return new PlatformJobClient();
  }
  throw new Error('Chưa đăng nhập');
}
