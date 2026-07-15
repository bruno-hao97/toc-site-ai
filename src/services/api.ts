import { DEFAULT_DOMAIN } from './settingsStore';
import { gommoDeviceFields } from './gommoDevice';

/** Prefix /v2 = cùng origin → proxy server forward tới v2.api.gommo.net (che URL). */
export const BASE_URL = '/v2';

export type JobType =
  | 'image'
  | 'video'
  | 'tts'
  | 'music'
  | 'avatar-lipsync'
  | 'image-upscale'
  | 'remove-bg'
  | 'video-upscale'
  | 'video-vfx'
  | 'video-subtitle'
  | 'video-cut';

export type PollMedia = 'image' | 'video' | 'music';

export const POLL_MEDIA: Record<JobType, PollMedia | null> = {
  image: 'image',
  video: 'video',
  tts: null,
  music: 'music',
  'avatar-lipsync': 'video',
  'image-upscale': 'image',
  'remove-bg': 'image',
  'video-upscale': 'video',
  'video-vfx': 'video',
  'video-subtitle': 'video',
  'video-cut': 'video',
};

export interface GommoEnvelope<T = Record<string, unknown>> {
  success?: boolean;
  data?: T;
  raw?: Record<string, unknown>;
  message?: string;
  _rawText?: string;
}

export interface GommoClientOptions {
  accessToken: string;
  domain?: string;
  projectId?: string;
}

export class GommoApiError extends Error {
  status?: number;
  envelope?: GommoEnvelope;

  constructor(message: string, opts?: { status?: number; envelope?: GommoEnvelope }) {
    super(message);
    this.name = 'GommoApiError';
    this.status = opts?.status;
    this.envelope = opts?.envelope;
  }
}

export class GommoClient {
  accessToken: string;
  domain: string;
  projectId: string;

  constructor({ accessToken, domain = DEFAULT_DOMAIN, projectId = 'default' }: GommoClientOptions) {
    this.accessToken = accessToken;
    this.domain = domain;
    this.projectId = projectId;
  }

  headers(extra: Record<string, string> = {}): Record<string, string> {
    return { Authorization: `Bearer ${this.accessToken}`, ...extra };
  }

  async parseResponse(res: Response): Promise<GommoEnvelope> {
    const text = await res.text();
    try {
      return JSON.parse(text) as GommoEnvelope;
    } catch {
      return { _rawText: text };
    }
  }

  async request(
    path: string,
    { method = 'GET', body, headers, retries = 2 }: {
      method?: string;
      body?: BodyInit;
      headers?: Record<string, string>;
      retries?: number;
    } = {},
  ): Promise<GommoEnvelope> {
    let lastError: GommoApiError | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(`${BASE_URL}${path}`, {
          method,
          headers: this.headers(headers),
          body,
        });
        const envelope = await this.parseResponse(res);

        if (res.status === 401 || res.status === 403) {
          throw new GommoApiError(envelope.message || `HTTP ${res.status}`, {
            status: res.status,
            envelope,
          });
        }

        if (res.status === 429 && attempt < retries) {
          await sleep(1000 * (attempt + 1) * 2);
          continue;
        }

        if (res.status >= 500 && attempt < retries) {
          await sleep(1000 * (attempt + 1));
          continue;
        }

        if (!res.ok || envelope.success === false) {
          throw new GommoApiError(envelope.message || `HTTP ${res.status}`, {
            status: res.status,
            envelope,
          });
        }

        return envelope;
      } catch (err) {
        if (err instanceof GommoApiError) {
          if ((err.status === 401 || err.status === 403) || attempt >= retries) throw err;
          lastError = err;
        } else if (attempt >= retries) {
          throw err;
        }
        await sleep(1000 * (attempt + 1));
        lastError = err instanceof GommoApiError ? err : new GommoApiError(String(err));
      }
    }

    throw lastError ?? new GommoApiError('Request failed');
  }

  flatten(obj: Record<string, unknown>, prefix = ''): Record<string, string | number | boolean> {
    const out: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(obj)) {
      const k = prefix ? `${prefix}[${key}]` : key;
      if (value != null && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(out, this.flatten(value as Record<string, unknown>, k));
      } else if (Array.isArray(value)) {
        value.forEach((item, i) => {
          if (item != null && typeof item === 'object') {
            Object.assign(out, this.flatten(item as Record<string, unknown>, `${k}[${i}]`));
          } else if (item != null) out[`${k}[${i}]`] = item as string | number | boolean;
        });
      } else if (value != null && value !== '') {
        out[k] = value as string | number | boolean;
      }
    }
    return out;
  }

  toForm(fields: Record<string, unknown>): string {
    const p = new URLSearchParams();
    Object.entries(this.flatten(fields)).forEach(([k, v]) => p.append(k, String(v)));
    return p.toString();
  }

  async postForm(path: string, fields: Record<string, unknown>): Promise<GommoEnvelope> {
    return this.request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: this.toForm(fields),
    });
  }

  async postJson(path: string, body: Record<string, unknown>): Promise<GommoEnvelope> {
    return this.request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async uploadImage(file: File, fileName?: string): Promise<{ url: string; envelope: GommoEnvelope }> {
    if (!this.accessToken) throw new GommoApiError('Chưa có access token');
    const name = fileName || file.name || 'image.png';
    const form = new FormData();
    form.append('access_token', this.accessToken);
    form.append('domain', this.domain);
    form.append('project_id', this.projectId);
    form.append('file', file, name);
    form.append('file_name', name);
    form.append('size', String(file.size ?? 0));

    const res = await fetch(`${BASE_URL}/ai/upload/image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.accessToken}` },
      body: form,
    });
    const envelope = await this.parseResponse(res);
    if (!res.ok || envelope.success === false) {
      throw new GommoApiError(envelope.message || `Upload HTTP ${res.status}`, {
        status: res.status,
        envelope,
      });
    }
    const data = envelope.data as Record<string, string> | undefined;
    const url = data?.url || data?.result_url || data?.image_url || (envelope as { url?: string }).url;
    if (!url) throw new GommoApiError('Upload thành công nhưng không có URL', { envelope });
    return { url, envelope };
  }

  async uploadVideo(file: File, fileName?: string): Promise<{ url: string; envelope: GommoEnvelope }> {
    if (!this.accessToken) throw new GommoApiError('Chưa có access token');
    const name = fileName || file.name || 'video.mp4';
    const form = new FormData();
    form.append('access_token', this.accessToken);
    form.append('domain', this.domain);
    form.append('project_id', this.projectId);
    form.append('video_file', file, name);

    const res = await fetch(`${BASE_URL}/ai/upload/video`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.accessToken}` },
      body: form,
    });
    const envelope = await this.parseResponse(res);
    if (!res.ok || envelope.success === false) {
      throw new GommoApiError(envelope.message || `Upload HTTP ${res.status}`, {
        status: res.status,
        envelope,
      });
    }
    const data = envelope.data as Record<string, string> | undefined;
    const url = data?.url || data?.result_url || data?.video_url;
    if (!url) throw new GommoApiError('Upload video thành công nhưng không có URL', { envelope });
    return { url, envelope };
  }

  async fetchModels(type: JobType): Promise<GommoEnvelope> {
    const q = `type=${encodeURIComponent(type)}&domain=${encodeURIComponent(this.domain)}`;
    const fields = { type, domain: this.domain, ...gommoDeviceFields() };
    try {
      return await this.postForm(`/ai/models?${q}`, fields);
    } catch {
      return await this.request(`/ai/models?${q}`);
    }
  }

  listModels(envelope: GommoEnvelope): GommoModel[] {
    const d = envelope?.data;
    if (Array.isArray(d)) return d as GommoModel[];
    if (d && Array.isArray((d as { models?: GommoModel[] }).models)) {
      return (d as { models: GommoModel[] }).models;
    }
    return [];
  }

  async createJob(
    type: JobType,
    modelId: string,
    fields: Record<string, unknown>,
  ): Promise<GommoEnvelope> {
    return this.postForm(`/ai/jobs/${type}/${modelId}`, {
      domain: this.domain,
      project_id: this.projectId,
      ...fields,
    });
  }

  async pollOnce(jobId: string, media: PollMedia): Promise<GommoEnvelope> {
    return this.postForm(`/ai/jobs/${encodeURIComponent(jobId)}?media=${media}`, {
      domain: this.domain,
      ...(media === 'music' ? { project_id: this.projectId } : {}),
    });
  }

  async checkHealth(): Promise<GommoEnvelope> {
    return this.request('/health');
  }

  async checkJobInfo(media: PollMedia, jobId: string): Promise<GommoEnvelope> {
    return this.postForm(`/ai/info/${media}/${encodeURIComponent(jobId)}`, {
      domain: this.domain,
      ...(media === 'music' ? { project_id: this.projectId } : {}),
    });
  }
}

export interface GommoModel {
  model?: string;
  slug?: string;
  model_id?: string;
  id?: string;
  name?: string;
  status?: string;
  status_message?: string;
  description?: string;
  server?: string;
  created_time?: number;
  price?: number;
  /** % giảm giá model (vd. 20 = −20%). */
  sale?: number;
  /** Loại tính giá upstream, vd. `per_second` cho Motion. */
  rate_type?: string;
  ratios?: unknown[];
  modes?: unknown[];
  mode?: unknown[];
  resolutions?: unknown[];
  durations?: unknown[];
  duration?: unknown[];
  withSubject?: boolean;
  withReference?: boolean;
  withMotion?: boolean;
  withMultiShots?: boolean;
  withEdit?: boolean;
  startImage?: boolean;
  startImageAndEnd?: boolean;
  maxSubject?: number;
  configs?: Record<string, unknown>;
  notices?: unknown;
  prices?: Array<{
    mode?: string;
    resolution?: string;
    /** Giá sale / đơn vị (vd. credit/s sau giảm). */
    price?: number;
    /** Giá niêm yết / đơn vị trước giảm. */
    price_default?: number;
    original_price?: number;
    price_original?: number;
    list_price?: number;
    promotion?: number;
    sale?: number;
  }>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
