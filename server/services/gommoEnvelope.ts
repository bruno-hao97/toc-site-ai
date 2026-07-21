type JsonRecord = Record<string, unknown>;

export function extractProviderJobId(envelope: JsonRecord): string | null {
  const data = envelope.data;
  if (!data || typeof data !== 'object') return null;
  const row = data as JsonRecord;
  for (const key of ['id_base', 'job_id', 'id']) {
    const val = row[key];
    if (val != null && String(val).trim()) return String(val);
  }
  return null;
}

export function extractResultUrl(envelope: JsonRecord): string | null {
  const data = (envelope.data as JsonRecord | undefined) ?? {};
  const raw = (envelope.raw as JsonRecord | undefined) ?? {};
  const imageInfo = raw.imageInfo as JsonRecord | undefined;
  const videoInfo = raw.videoInfo as JsonRecord | undefined;
  const candidates = [
    data.result_url,
    imageInfo?.result_url,
    videoInfo?.result_url,
    videoInfo?.url,
  ];
  for (const url of candidates) {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) return url;
  }
  return null;
}

export function extractStatus(envelope: JsonRecord): string {
  const data = envelope.data as JsonRecord | undefined;
  const raw = envelope.raw as JsonRecord | undefined;
  if (data?.status != null && String(data.status).trim()) return String(data.status);
  if (raw?.status != null && String(raw.status).trim()) return String(raw.status);
  const imageInfo = raw?.imageInfo as JsonRecord | undefined;
  const videoInfo = raw?.videoInfo as JsonRecord | undefined;
  if (imageInfo?.status != null && String(imageInfo.status).trim()) return String(imageInfo.status);
  if (videoInfo?.status != null && String(videoInfo.status).trim()) return String(videoInfo.status);
  return '';
}

/** Flatten nested fields for application/x-www-form-urlencoded (gommo job create). */
export function flattenFormFields(value: unknown, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  if (value == null) return out;

  if (Array.isArray(value)) {
    value.forEach((item, i) => {
      const k = prefix ? `${prefix}[${i}]` : String(i);
      if (item != null && typeof item === 'object') {
        Object.assign(out, flattenFormFields(item, k));
      } else if (item != null && item !== '') {
        out[k] = String(item);
      }
    });
    return out;
  }

  if (typeof value !== 'object') {
    if (value !== '' && prefix) out[prefix] = String(value);
    return out;
  }

  for (const [key, item] of Object.entries(value as JsonRecord)) {
    const k = prefix ? `${prefix}[${key}]` : key;
    if (item != null && typeof item === 'object') {
      Object.assign(out, flattenFormFields(item, k));
    } else if (item != null && item !== '') {
      out[k] = String(item);
    }
  }
  return out;
}

export function gommoModelId(model: JsonRecord): string {
  for (const key of ['model_id', 'modelId', 'id', 'slug']) {
    const val = model[key];
    if (val != null && String(val).trim()) return String(val);
  }
  return '';
}

export function resolveModelPrice(model: JsonRecord, mode: string, resolution: string): number {
  const prices = model.prices;
  if (!Array.isArray(prices)) return 0;
  const base = Number(model.base_price ?? model.price ?? 0) || 0;
  let hit: JsonRecord | null = null;
  for (const row of prices) {
    if (!row || typeof row !== 'object') continue;
    const p = row as JsonRecord;
    const pMode = String(p.mode ?? '').trim();
    const pRes = String(p.resolution ?? '').trim();
    if (mode && pMode && pMode !== mode) continue;
    if (resolution && pRes && pRes !== resolution) continue;
    hit = p;
    if (mode && resolution) break;
  }
  if (hit?.price != null) return Math.max(0, Number(hit.price) || 0);
  if (base > 0) return base;
  const first = prices[0];
  if (first && typeof first === 'object' && (first as JsonRecord).price != null) {
    return Math.max(0, Number((first as JsonRecord).price) || 0);
  }
  return 0;
}

export async function resolveJobCost(
  bridgeBase: string,
  authHeader: string,
  type: string,
  modelId: string,
  fields: JsonRecord,
): Promise<number> {
  const mode = String(fields.mode ?? '').trim();
  const resolution = String(fields.resolution ?? '').trim();
  try {
    const res = await fetch(`${bridgeBase}/job-models.php?type=${encodeURIComponent(type)}`, {
      headers: { Authorization: authHeader, Accept: 'application/json' },
    });
    const parsed = (await res.json()) as {
      success?: boolean;
      data?: { data?: unknown[] };
    };
    const models = parsed.data?.data;
    if (!Array.isArray(models)) return 10;
    const needle = modelId.toLowerCase();
    for (const model of models) {
      if (!model || typeof model !== 'object') continue;
      const row = model as JsonRecord;
      if (gommoModelId(row).toLowerCase() !== needle) continue;
      const price = resolveModelPrice(row, mode, resolution);
      if (price > 0) return price;
      break;
    }
  } catch {
    // fallback
  }
  return 10;
}
