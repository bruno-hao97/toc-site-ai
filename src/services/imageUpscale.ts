import {
  GommoApiError,
  type GommoModel,
  type JobType,
} from './api';
import { getGommoClient, notifyCreditsUpdated } from './authStore';
import { gommoDeviceFields } from './gommoDevice';
import { isModelAvailable, normalizeOptions } from './modelSchema';
import { createJobAndPoll } from './polling';

export const UPSCALE_JOB_TYPE = 'image-upscale' as JobType;
export const UPSCALE_MODEL_ID = 'generative_upscale_v2';

export async function fetchUpscaleModels(): Promise<GommoModel[]> {
  const client = getGommoClient();
  const envelope = await client.fetchModels(UPSCALE_JOB_TYPE);
  return client.listModels(envelope);
}

export function pickUpscaleModel(models: GommoModel[]): GommoModel | null {
  const found =
    models.find((m) => (m.model || m.slug) === UPSCALE_MODEL_ID) ||
    models.find((m) => isModelAvailable(m));
  return found ?? models[0] ?? null;
}

export function resolveUpscalePrice(
  model: GommoModel,
  mode: string,
  resolution: string,
): number | undefined {
  const row = model.prices?.find((p) => p.mode === mode && p.resolution === resolution);
  if (row?.price != null) return row.price;
  const modeOpt = normalizeOptions(model.mode || model.modes).find((o) => o.value === mode);
  if (modeOpt?.price != null) return modeOpt.price;
  return model.price;
}

export interface UpscaleOptions {
  mode: string;
  resolution: string;
  modelId?: string;
}

export async function runImageUpscale(
  imageUrl: string,
  opts: UpscaleOptions,
  onProgress?: (msg: string) => void,
): Promise<string> {
  const url = imageUrl.trim();
  if (!url) throw new GommoApiError('Thiếu URL ảnh');

  const modelId = opts.modelId?.trim() || UPSCALE_MODEL_ID;
  const payload: Record<string, unknown> = {
    subjects: [{ url }],
    mode: opts.mode,
    resolution: opts.resolution,
    prompt: 'upscale',
  };

  const client = getGommoClient();
  onProgress?.('Đang tạo job upscale…');
  const { resultUrl, pollResult } = await createJobAndPoll(
    client,
    UPSCALE_JOB_TYPE,
    modelId,
    payload,
    (p) => {
      if ('phase' in p && p.phase === 'creating') onProgress?.('Đang gửi yêu cầu…');
      else if ('phase' in p) onProgress?.(`Đang xử lý… (${p.phase})`);
    },
  );
  notifyCreditsUpdated();
  if (!resultUrl) {
    throw new GommoApiError(pollResult?.error || 'Upscale thất bại');
  }
  return resultUrl;
}

export function modelsRequestFields(type: string): Record<string, string> {
  return { type, ...gommoDeviceFields() };
}
