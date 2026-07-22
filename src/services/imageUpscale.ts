import {
  GommoApiError,
  type GommoModel,
  type JobType,
} from './api';
import { notifyCreditsUpdated } from './authStore';
import { gommoDeviceFields } from './gommoDevice';
import { resolveModelPrice } from './modelPricing';
import { isModelAvailable, normalizeOptions } from './modelSchema';
import { getJobClient } from './platformJobClient';
import { createJobAndPoll, type PollProgress } from './polling';
import {
  formatCreatingProgressMessage,
  formatPollProgressMessage,
  formatStartingProgressMessage,
} from './pollProgressCopy';

export const UPSCALE_JOB_TYPE = 'image-upscale' as JobType;
export const UPSCALE_MODEL_ID = 'generative_upscale_v2';

export async function fetchUpscaleModels(): Promise<GommoModel[]> {
  const client = getJobClient();
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
  const fromTable = resolveModelPrice(model, mode, resolution);
  if (fromTable > 0) return fromTable;
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

  const client = getJobClient();
  onProgress?.(formatStartingProgressMessage());
  const { resultUrl, pollResult } = await createJobAndPoll(
    client,
    UPSCALE_JOB_TYPE,
    modelId,
    payload,
    (p) => {
      if ('phase' in p && p.phase === 'creating') {
        onProgress?.(formatCreatingProgressMessage());
        return;
      }
      onProgress?.(formatPollProgressMessage(p as PollProgress));
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
