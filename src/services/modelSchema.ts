import type { GommoModel, JobType } from './api';
import { DEFAULT_DOMAIN } from './settingsStore';
import { POLL_MEDIA } from './api';
import type { ComposerShot } from './composerShots';
import { buildMultiShotPayload, getMultiShotConfig } from './composerShots';
import { gommoDeviceFields } from './gommoDevice';

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
    musicStyle: boolean;
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
  /** Suno/VMedia: phong cách nhạc → gửi lên API dưới key `styles` (≥ 3 ký tự). */
  style?: string;
  /** Không lời — omit `prompt` như VMedia khi bật. */
  instrumental?: boolean;
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

/** Giữ selection cũ chỉ khi còn trong options của model hiện tại. */
export function pickAllowedOption(
  current: string | undefined,
  options: ModelOption[],
): string | undefined {
  if (current && options.some((o) => o.value === current)) return current;
  return options[0]?.value;
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

/** Gom/vmedia: thành phần tham chiếu (ảnh/video/audio) luôn gửi qua `subjects[]`. */
export function componentMediaField(
  _model: GommoModel,
  _schema: ModelSchema,
): 'subjects' {
  return 'subjects';
}

/** Gộp subjects + references cũ (state legacy) thành một danh sách URL. */
export function collectComponentUrls(selections: JobSelections): string[] {
  return [
    ...new Set([...(selections.subjects || []), ...(selections.references || [])].filter(Boolean)),
  ];
}

/** Chuẩn hóa state composer — chỉ giữ `subjects`, bỏ `references`. */
export function normalizeComponentSelections(selections: JobSelections): JobSelections {
  const urls = collectComponentUrls(selections);
  const next = { ...selections };
  if (urls.length) next.subjects = urls;
  else delete next.subjects;
  delete next.references;
  return next;
}

export function analyzeModel(model: GommoModel, jobType: JobType): ModelSchema {
  const ratios = normalizeOptions(model.ratios);
  const modes = getModesList(model);
  const resolutions = normalizeOptions(model.resolutions);
  const durations = normalizeOptions(model.durations || model.duration);
  const refLimits = getReferenceLimitsFromModel(model);
  const refLimit = refLimits.image || refLimits.total;
  const maxSubjectRaw = Number(model.maxSubject) || 0;
  const maxSubject = Math.max(maxSubjectRaw, refLimits.image || 0, refLimit || 0);
  const hasComponentMedia =
    maxSubject > 0 || refLimit > 0 || Boolean(model.withSubject) || Boolean(model.withReference);
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
      // Music: prompt = lời bài hát; style = phong cách (riêng field).
      prompt: !['tts'].includes(jobType),
      text: jobType === 'tts',
      musicName: jobType === 'music',
      musicStyle: jobType === 'music',
      ratio: ratios.length > 0,
      mode: modes.length > 0,
      resolution: resolutions.length > 0,
      duration: durations.length > 0,
      templateId: Boolean((configs.templates as { enabled?: boolean })?.enabled),
      subjects: hasComponentMedia,
      references: false,
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
    language: 'VI',
    ...gommoDeviceFields(),
  };

  if (!schema.available) {
    throw new Error(schema.statusMessage || `Model không khả dụng (${schema.status})`);
  }

  if (schema.fields.prompt && selections.prompt) payload.prompt = selections.prompt;
  if (schema.fields.text && selections.text) payload.text = selections.text;

  if (jobType === 'music') {
    if (selections.name) payload.name = selections.name;
    // VMedia form: `styles` = phong cách; `prompt` = lời (omit khi Không lời).
    const style = (selections.style || '').trim();
    const lyrics = (selections.prompt || '').trim();
    const styleValue = style || (!selections.instrumental ? lyrics : '');
    if (styleValue) {
      payload.styles = styleValue;
      // Alias phòng upstream cũ / bridge đọc key khác.
      payload.style = styleValue;
      payload.tags = styleValue;
    }
    if (selections.instrumental) {
      delete payload.prompt;
    } else if (style && lyrics) {
      payload.prompt = lyrics;
    } else if (!style && lyrics) {
      // Legacy: chỉ có prompt → đã map sang styles, không gửi lại làm lời.
      delete payload.prompt;
    }
    if (selections.gender != null) payload.gender = selections.gender;
  }

  const ratio = schema.fields.ratio
    ? pickAllowedOption(selections.ratio, schema.options.ratios)
    : undefined;
  const mode = schema.fields.mode
    ? pickAllowedOption(selections.mode, schema.options.modes)
    : undefined;
  const resolution = schema.fields.resolution
    ? pickAllowedOption(selections.resolution, schema.options.resolutions)
    : undefined;
  const duration = schema.fields.duration
    ? pickAllowedOption(selections.duration, schema.options.durations)
    : undefined;

  if (ratio) payload.ratio = ratio;
  if (mode) payload.mode = mode;
  if (resolution) payload.resolution = resolution;
  if (duration) payload.duration = duration;
  if (selections.template_id) payload.template_id = selections.template_id;

  const images = (selections.images || []).filter(Boolean);
  if (schema.fields.startFrame && images[0]) {
    payload.images = [{ url: images[0] }];
    if (schema.fields.endFrame && images[1]) {
      (payload.images as { url: string }[]).push({ url: images[1] });
    }
  }

  const componentUrls = collectComponentUrls(selections);
  if (componentUrls.length) {
    payload.subjects = componentUrls.map((url) => ({ url }));
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
  return {
    ratio: pickAllowedOption(undefined, schema.options.ratios),
    mode: pickAllowedOption(undefined, schema.options.modes),
    resolution: pickAllowedOption(undefined, schema.options.resolutions),
    duration: pickAllowedOption(undefined, schema.options.durations),
  };
}

/** Merge selection cũ với schema mới — bỏ enum không còn hợp lệ. */
export function mergeSelectionsForSchema(
  prev: JobSelections,
  schema: ModelSchema,
  extras?: Partial<JobSelections>,
): JobSelections {
  const defs = defaultSelections(schema);
  const merged: JobSelections = {
    ...prev,
    ...extras,
    ratio: pickAllowedOption(prev.ratio, schema.options.ratios) ?? defs.ratio,
    mode: pickAllowedOption(prev.mode, schema.options.modes) ?? defs.mode,
    resolution:
      pickAllowedOption(prev.resolution, schema.options.resolutions) ?? defs.resolution,
    duration: pickAllowedOption(prev.duration, schema.options.durations) ?? defs.duration,
  };
  return normalizeComponentSelections(merged);
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
