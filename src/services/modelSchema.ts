import type { GommoModel, JobType } from './api';
import { DEFAULT_DOMAIN } from './settingsStore';
import { POLL_MEDIA } from './api';
import type { ComposerShot } from './composerShots';
import { buildMultiShotPayload, getMultiShotConfig } from './composerShots';

export interface ModelOption {
  value: string;
  label: string;
  description?: string;
  price?: number;
  group?: string;
}

export interface ModelSchema {
  slug: string;
  name?: string;
  status?: string;
  statusMessage?: string;
  available: boolean;
  description?: string;
  basePrice?: number;
  jobType: JobType;
  flags: {
    withSubject: boolean;
    withMotion: boolean;
    withMultiShots: boolean;
    withEdit: boolean;
    startImage: boolean;
    startImageAndEnd: boolean;
    withReference: boolean;
  };
  fields: {
    prompt: boolean;
    text: boolean;
    musicName: boolean;
    ratio: boolean;
    mode: boolean;
    resolution: boolean;
    duration: boolean;
    templateId: boolean;
    subjects: boolean;
    references: boolean;
    startFrame: boolean;
    endFrame: boolean;
    motion: boolean;
    multiShots: boolean;
    edit: boolean;
  };
  limits: { maxSubject: number; maxReference: number; maxReferenceImage: number; maxReferenceVideo: number };
  options: {
    ratios: ModelOption[];
    modes: ModelOption[];
    resolutions: ModelOption[];
    durations: ModelOption[];
  };
  configs: Record<string, unknown>;
}

export interface JobSelections {
  prompt?: string;
  text?: string;
  name?: string;
  gender?: string;
  ratio?: string;
  mode?: string;
  resolution?: string;
  duration?: string;
  template_id?: string;
  images?: string[];
  references?: string[];
  subjects?: string[];
  shots?: ComposerShot[];
  extra?: Record<string, unknown>;
}

export function parseModelsList(envelopeOrData: unknown): GommoModel[] {
  if (Array.isArray(envelopeOrData)) return envelopeOrData as GommoModel[];
  const root = envelopeOrData as { envelope?: unknown; data?: unknown };
  const d = (root?.envelope as { data?: unknown })?.data ?? root?.data ?? root;
  if (Array.isArray(d)) return d as GommoModel[];
  if (d && Array.isArray((d as { models?: GommoModel[] }).models)) {
    return (d as { models: GommoModel[] }).models;
  }
  if (d && Array.isArray((d as { items?: GommoModel[] }).items)) {
    return (d as { items: GommoModel[] }).items;
  }
  return [];
}

export function modelSlug(model: GommoModel): string {
  return model?.model || model?.slug || model?.model_id || model?.id || '';
}

export function isModelAvailable(model: GommoModel): boolean {
  const s = String(model?.status || 'ON').toUpperCase();
  return s === 'ON' || s === 'ACTIVE';
}

export function normalizeOptions(list: unknown): ModelOption[] {
  if (!Array.isArray(list) || list.length === 0) return [];
  return list.map((item) => {
    if (typeof item === 'string') return { value: item, label: item };
    const obj = item as Record<string, unknown>;
    const value = obj.type ?? obj.value ?? obj.name;
    return {
      value: String(value),
      label: obj.name ? String(obj.name) : String(value),
      description: obj.description as string | undefined,
      price: obj.price as number | undefined,
      group: obj.group as string | undefined,
    };
  });
}

function getModesList(model: GommoModel): ModelOption[] {
  if (Array.isArray(model.modes) && model.modes.length) return normalizeOptions(model.modes);
  if (Array.isArray(model.mode) && model.mode.length) return normalizeOptions(model.mode);
  return [];
}

function getReferenceLimitsFromModel(model: GommoModel): {
  image: number;
  video: number;
  total: number;
} {
  const c = (model.configs || {}) as Record<string, Record<string, unknown>>;
  const ref = c.reference as { limits?: { image?: number; video?: number } } | undefined;
  const tpl = c.templates as { override?: { reference?: { limits?: { image?: number; video?: number } } } } | undefined;
  const image =
    Number(ref?.limits?.image) ||
    Number(tpl?.override?.reference?.limits?.image) ||
    (model.withReference ? 3 : 0);
  const video =
    Number(ref?.limits?.video) ||
    Number(tpl?.override?.reference?.limits?.video) ||
    0;
  return { image, video, total: image + (video || 0) };
}

export function analyzeModel(model: GommoModel, jobType: JobType): ModelSchema {
  const ratios = normalizeOptions(model.ratios);
  const modes = getModesList(model);
  const resolutions = normalizeOptions(model.resolutions);
  const durations = normalizeOptions(model.durations || model.duration);
  const refLimits = getReferenceLimitsFromModel(model);
  const refLimit = refLimits.image || refLimits.total;
  const maxSubject = Number(model.maxSubject) || 0;
  const configs = model.configs || {};

  return {
    slug: modelSlug(model),
    name: model.name,
    status: model.status,
    statusMessage: model.status_message,
    available: isModelAvailable(model),
    description: model.description,
    basePrice: model.price,
    jobType,
    flags: {
      withSubject: Boolean(model.withSubject),
      withMotion: Boolean(model.withMotion),
      withMultiShots: Boolean(model.withMultiShots),
      withEdit: Boolean(model.withEdit),
      startImage: Boolean(model.startImage),
      startImageAndEnd: Boolean(model.startImageAndEnd),
      withReference: Boolean(model.withReference) || refLimit > 0,
    },
    fields: {
      prompt: !['tts'].includes(jobType),
      text: jobType === 'tts',
      musicName: jobType === 'music',
      ratio: ratios.length > 0,
      mode: modes.length > 0,
      resolution: resolutions.length > 0,
      duration: durations.length > 0,
      templateId: Boolean((configs.templates as { enabled?: boolean })?.enabled),
      subjects: Boolean(model.withSubject) && maxSubject > 0,
      references: refLimit > 0 || Boolean(model.withReference),
      startFrame: Boolean(model.startImage),
      endFrame: Boolean(model.startImageAndEnd),
      motion: Boolean(model.withMotion),
      multiShots: Boolean(model.withMultiShots),
      edit: Boolean(model.withEdit),
    },
    limits: {
      maxSubject,
      maxReference: refLimit,
      maxReferenceImage: refLimits.image || refLimit,
      maxReferenceVideo: refLimits.video,
    },
    options: { ratios, modes, resolutions, durations },
    configs,
  };
}

export function buildJobPayload(
  model: GommoModel,
  jobType: JobType,
  selections: JobSelections,
  { domain, projectId }: { domain?: string; projectId?: string } = {},
): { payload: Record<string, unknown>; schema: ModelSchema } {
  const schema = analyzeModel(model, jobType);
  const payload: Record<string, unknown> = {
    domain: domain || DEFAULT_DOMAIN,
    project_id: projectId || 'default',
  };

  if (!schema.available) {
    throw new Error(schema.statusMessage || `Model không khả dụng (${schema.status})`);
  }

  if (schema.fields.prompt && selections.prompt) payload.prompt = selections.prompt;
  if (schema.fields.text && selections.text) payload.text = selections.text;

  if (jobType === 'music') {
    if (selections.name) payload.name = selections.name;
    if (selections.prompt) payload.prompt = selections.prompt;
    if (selections.gender != null) payload.gender = selections.gender;
  }

  if (selections.ratio) payload.ratio = selections.ratio;
  if (selections.mode) payload.mode = selections.mode;
  if (selections.resolution) payload.resolution = selections.resolution;
  if (selections.duration) payload.duration = selections.duration;
  if (selections.template_id) payload.template_id = selections.template_id;

  const images = (selections.images || []).filter(Boolean);
  if (schema.fields.startFrame && images[0]) {
    payload.images = [{ url: images[0] }];
    if (schema.fields.endFrame && images[1]) {
      (payload.images as { url: string }[]).push({ url: images[1] });
    }
  }

  const refs = (selections.references || []).filter(Boolean);
  if (schema.fields.references && refs.length) {
    payload.references = refs.map((url) => ({ url }));
  }

  const subjects = (selections.subjects || []).filter(Boolean);
  if (schema.fields.subjects && subjects.length) {
    payload.subjects = subjects.map((url) => ({ url }));
  }

  Object.assign(payload, selections.extra || {});

  const shotList = (selections.shots || []).filter((s) => s.prompt?.trim());
  if (schema.fields.multiShots && shotList.length >= 2) {
    const msCfg = getMultiShotConfig(model);
    Object.assign(
      payload,
      buildMultiShotPayload(shotList, selections.duration, msCfg),
    );
    delete payload.prompt;
  }

  // Motion (Kling…): đảm bảo ratio mặc định nếu model hỗ trợ.
  if (selections.extra?.subType === 'motion' && !payload.ratio) {
    const hasDefault = schema.options.ratios.some(
      (r) => r.value.toLowerCase() === 'default' || r.label.toLowerCase().includes('auto'),
    );
    if (hasDefault) payload.ratio = 'default';
  }

  // Edit video: map video nguồn.
  if (selections.extra?.subType === 'edit') {
    const src = selections.extra.video_url as string | undefined;
    if (src) {
      payload.video_url = src;
      if (!payload.videos) payload.videos = [{ url: src }];
    }
  }

  return { payload, schema };
}

export function pollMediaForJobType(jobType: JobType): (typeof POLL_MEDIA)[JobType] {
  return POLL_MEDIA[jobType] ?? 'video';
}

export function defaultSelections(schema: ModelSchema): Partial<JobSelections> {
  const pick = (opts: ModelOption[]) => (opts.length ? opts[0].value : undefined);
  return {
    ratio: pick(schema.options.ratios),
    mode: pick(schema.options.modes),
    resolution: pick(schema.options.resolutions),
    duration: pick(schema.options.durations),
  };
}

const MODELS_CACHE = new Map<string, { at: number; models: GommoModel[] }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export function getCachedModels(type: JobType): GommoModel[] | null {
  const entry = MODELS_CACHE.get(type);
  if (!entry || Date.now() - entry.at > CACHE_TTL_MS) return null;
  return entry.models;
}

export function setCachedModels(type: JobType, models: GommoModel[]): void {
  MODELS_CACHE.set(type, { at: Date.now(), models });
}

export function clearModelsCache(): void {
  MODELS_CACHE.clear();
}
