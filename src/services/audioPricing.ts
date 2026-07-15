import type { GommoModel } from './api';
import type { VoiceProvider } from './audioVoices';
import { normalizeElevenLabsCheapModel } from './audioCatalog';
import { modelSlug } from './modelSchema';

/** Credits / 100 ký tự — khớp vmedia.ai khi API không trả price hợp lệ. */
export const TTS_PRICE_PER_100: Record<VoiceProvider, number> = {
  omnivoice_local: 20,
  elevenlabs_cheap: 35,
  minimaxai_cheap: 50,
};

/** price từ API TTS = credits/100 ký tự; bỏ qua giá voice card (thường 1–5). */
const MIN_TTS_PRICE_PER_100 = 10;

export interface AudioTtsPricing {
  pricePer100: number;
  baseCreditPerChar: number;
  creditPerChar: number;
  saleFactor: number;
  estimatedCost: number;
  baseEstimatedCost: number;
  hasSale: boolean;
}

function saleFactorFromModel(model: GommoModel | null): number {
  if (model?.sale == null || !Number.isFinite(model.sale) || model.sale <= 0) return 1;
  const s = model.sale;
  if (s > 0 && s <= 1) return s;
  if (s >= 100) return 0;
  return (100 - s) / 100;
}

function modelIds(model: GommoModel): string[] {
  const slug = modelSlug(model);
  const ids = new Set<string>();
  for (const v of [slug, model.model_id, model.model, model.slug, model.id]) {
    if (v == null || v === '') continue;
    const s = String(v).toLowerCase();
    ids.add(s);
    if (/eleven/.test(s)) {
      ids.add(normalizeElevenLabsCheapModel(s).toLowerCase());
    }
  }
  return [...ids];
}

function readModelPricePer100(
  model: GommoModel | null,
  provider: VoiceProvider,
): number {
  if (model) {
    if (typeof model.price === 'number' && model.price >= MIN_TTS_PRICE_PER_100) {
      return model.price;
    }
    if (Array.isArray(model.prices)) {
      const values = model.prices
        .map((p) => p?.price)
        .filter((n): n is number => typeof n === 'number' && n >= MIN_TTS_PRICE_PER_100);
      if (values.length) return Math.min(...values);
    }
  }
  return TTS_PRICE_PER_100[provider];
}

function catalogNeedleIds(catalogModelId: string): string[] {
  const needle = catalogModelId.trim().toLowerCase();
  if (!needle) return [];
  const ids = new Set<string>([needle]);
  if (/eleven/.test(needle)) {
    ids.add(normalizeElevenLabsCheapModel(needle).toLowerCase());
  }
  return [...ids];
}

function matchScore(model: GommoModel, needles: string[]): number {
  const ids = modelIds(model);
  let best = 0;
  for (const needle of needles) {
    for (const id of ids) {
      if (id === needle) best = Math.max(best, 100 + needle.length);
      else if (id.includes(needle) || needle.includes(id)) {
        best = Math.max(best, 50 + Math.min(id.length, needle.length));
      }
    }
  }
  return best;
}

/** Khớp model catalog (voiceEngineModel) với entry từ fetchModels('tts'). */
export function findTtsPricingModel(
  models: GommoModel[],
  catalogModelId: string,
): GommoModel | null {
  if (!models.length) return null;
  const needles = catalogNeedleIds(catalogModelId);
  if (!needles.length) return models[0];

  let best: GommoModel | null = null;
  let bestScore = 0;
  for (const m of models) {
    const score = matchScore(m, needles);
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best ?? models[0];
}

export function computeAudioTtsPricing(opts: {
  provider: VoiceProvider;
  pricingModel: GommoModel | null;
  charCount: number;
}): AudioTtsPricing {
  const { provider, pricingModel, charCount } = opts;

  const pricePer100 = readModelPricePer100(pricingModel, provider);
  const saleFactor = saleFactorFromModel(pricingModel);
  const baseCreditPerChar = pricePer100 / 100;
  const creditPerChar = baseCreditPerChar * saleFactor;
  const chars = Math.max(0, charCount);
  const baseEstimatedCost = chars === 0 ? 0 : Math.ceil(chars * baseCreditPerChar);
  const estimatedCost = chars === 0 ? 0 : Math.ceil(chars * creditPerChar);

  return {
    pricePer100,
    baseCreditPerChar,
    creditPerChar,
    saleFactor,
    estimatedCost,
    baseEstimatedCost,
    hasSale: saleFactor < 0.999,
  };
}

export function formatSaleMultiplierLabel(factor: number): string {
  if (factor >= 0.999) return '';
  const text = factor.toFixed(2).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  return `(x${text})`;
}

export function formatCreditRate(rate: number, locale: string): string {
  return rate.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
