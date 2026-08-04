import {
  GommoClient,
  type GommoEnvelope,
  type GommoModel,
  type JobType,
  type PollMedia,
} from './api';
import {
  ensureValidPlatformSession,
  handlePlatformAuthFailure,
  loadAuth,
  getGommoClient,
  refreshPlatformToken,
  saveAuth,
} from './authStore';
import {
  humanizePlatformError,
  parsePlatformJson,
} from './platformApiError';
import { PLATFORM_BRIDGE } from './platformBridge';
import { extractUploadUrl } from './uploadUrl';

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

  private async platformFetch(url: string, init: RequestInit): Promise<Response> {
    await ensureValidPlatformSession();
    let res = await fetch(url, init);
    if (res.status === 401 || res.status === 403) {
      try {
        await refreshPlatformToken();
        res = await fetch(url, {
          ...init,
          headers: {
            ...(init.headers as Record<string, string> | undefined),
            ...this.authHeaders(),
          },
        });
      } catch {
        /* retry failed — handle below */
      }
    }
    return res;
  }

  private assertPlatformOk<T extends { success?: boolean; message?: string }>(
    res: Response,
    text: string,
    parsed: T,
    fallback: string,
  ): T {
    if (res.status === 401 || res.status === 403) {
      handlePlatformAuthFailure(
        res.status,
        humanizePlatformError(text, res.status, parsed.message),
      );
      throw new Error(humanizePlatformError(text, res.status, parsed.message));
    }
    if (!res.ok || parsed.success === false) {
      throw new Error(
        humanizePlatformError(text, res.status, parsed.message || fallback),
      );
    }
    return parsed;
  }

  private async postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const res = await this.platformFetch(path, {
      method: 'POST',
      headers: {
        ...this.authHeaders(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    const parsed = parsePlatformJson<T & { success?: boolean; message?: string }>(text, res.status);
    return this.assertPlatformOk(res, text, parsed, `HTTP ${res.status}`) as T;
  }

  private async upload(
    kind: 'image' | 'video',
    file: File,
    fileName?: string,
  ): Promise<{ url: string; envelope: GommoEnvelope }> {
    const name = fileName || file.name || (kind === 'video' ? 'video.mp4' : 'image.png');
    const form = new FormData();
    form.append('kind', kind);
    form.append('file', file, name);
    form.append('file_name', name);

    const res = await this.platformFetch(PLATFORM_BRIDGE.jobUpload, {
      method: 'POST',
      headers: {
        ...this.authHeaders(),
        Accept: 'application/json',
      },
      body: form,
    });
    const text = await res.text();
    const parsed = parsePlatformJson<{
      success?: boolean;
      message?: string;
      data?: { url?: string; envelope?: GommoEnvelope };
    }>(text, res.status);
    this.assertPlatformOk(res, text, parsed, 'Upload thất bại');

    const url =
      parsed.data?.url ||
      (parsed.data?.envelope ? extractUploadUrl(parsed.data.envelope) : null);
    if (!url) {
      throw new Error(parsed.message || 'Upload thành công nhưng không có URL');
    }
    return {
      url,
      envelope: parsed.data?.envelope || { success: true, data: { url } },
    };
  }

  async fetchModels(type: JobType): Promise<GommoEnvelope> {
    const res = await this.platformFetch(
      `${PLATFORM_BRIDGE.jobModels}?type=${encodeURIComponent(type)}`,
      {
        headers: this.authHeaders(),
      },
    );
    const text = await res.text();
    const parsed = parsePlatformJson<{
      success?: boolean;
      message?: string;
      data?: GommoEnvelope;
    }>(text, res.status);
    this.assertPlatformOk(res, text, parsed, 'Không tải được models');
    if (!parsed.data) {
      throw new Error('Không tải được danh sách model. Vui lòng thử lại.');
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

export function getJobClient(): PlatformJobClient | GommoClient {
  const auth = loadAuth();
  if (auth?.platform_token?.trim()) return new PlatformJobClient();
  if (auth?.access_token?.trim()) return getGommoClient();
  throw new Error('Chưa đăng nhập');
}
