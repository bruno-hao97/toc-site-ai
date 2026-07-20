import {
  GommoClient,
  type GommoEnvelope,
  type GommoModel,
  type JobType,
  type PollMedia,
} from './api';
import { loadAuth, saveAuth } from './authStore';
import { PLATFORM_BRIDGE } from './platformBridge';

/** GommoClient qua server — trừ credit platform + token admin VMedia. */
export class PlatformJobClient {
  domain = 'vmedia.ai';
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
      const errMsg = (parsed as { message?: string }).message || `HTTP ${res.status}`;
      throw new Error(errMsg);
    }
    return parsed;
  }

  private async upload(
    kind: 'image' | 'video',
    file: File,
    fileName?: string,
  ): Promise<{ url: string; envelope: GommoEnvelope }> {
    const form = new FormData();
    form.append('kind', kind);
    form.append('file', file, fileName || file.name);

    const res = await fetch(PLATFORM_BRIDGE.jobUpload, {
      method: 'POST',
      headers: {
        ...this.authHeaders(),
        Accept: 'application/json',
      },
      body: form,
    });
    const text = await res.text();
    let parsed: {
      success?: boolean;
      message?: string;
      data?: { url?: string; envelope?: GommoEnvelope };
    };
    try {
      parsed = JSON.parse(text) as typeof parsed;
    } catch {
      throw new Error(text || `HTTP ${res.status}`);
    }
    if (!res.ok || !parsed.success || !parsed.data?.url) {
      throw new Error(parsed.message || 'Upload thất bại');
    }
    return {
      url: parsed.data.url,
      envelope: parsed.data.envelope || { success: true, data: { url: parsed.data.url } },
    };
  }

  async fetchModels(type: JobType): Promise<GommoEnvelope> {
    const res = await fetch(`${PLATFORM_BRIDGE.jobModels}?type=${encodeURIComponent(type)}`, {
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
    return new GommoClient({ platformToken: 'parser-only' }).listModels(envelope);
  }

  async createJob(
    type: JobType,
    modelId: string,
    fields: Record<string, unknown>,
  ): Promise<GommoEnvelope> {
    const parsed = await this.postJson<{
      data: { envelope: GommoEnvelope; credits?: number; platformJobId?: string };
    }>(PLATFORM_BRIDGE.jobCreate, { type, modelId, fields });

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
    const parsed = await this.postJson<{ data: { envelope: GommoEnvelope } }>(PLATFORM_BRIDGE.jobPoll, {
      providerJobId: jobId,
      media,
    });
    return parsed.data.envelope;
  }

  async uploadImage(file: File, fileName?: string): Promise<{ url: string; envelope: GommoEnvelope }> {
    return this.upload('image', file, fileName);
  }

  async uploadVideo(file: File, fileName?: string): Promise<{ url: string; envelope: GommoEnvelope }> {
    return this.upload('video', file, fileName);
  }
}

export function usesPlatformJobs(): boolean {
  return Boolean(loadAuth()?.platform_token?.trim());
}

export function getJobClient(): PlatformJobClient {
  const auth = loadAuth();
  if (!auth?.platform_token?.trim()) throw new Error('Chưa đăng nhập');
  return new PlatformJobClient();
}
