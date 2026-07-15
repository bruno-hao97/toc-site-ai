import type { TranslationKey } from '../i18n/types';
import type { VoiceItem } from './audioVoices';

/** model_id gửi lên API create_audio. */
export interface TtsModelOption {
  modelId: string;
  labelKey: TranslationKey;
  badgeKey?: TranslationKey;
  /** Khớp với verified_languages[].model_id của voice. */
  matchIds: string[];
}

/** Catalog ElevenLabs — khớp vmedia.ai (label + model_id thật). */
export const ELEVENLABS_MODEL_CATALOG: TtsModelOption[] = [
  {
    modelId: 'eleven_v3',
    labelKey: 'audio.model.elevenV3',
    badgeKey: 'audio.model.badgeNewest',
    matchIds: ['eleven_v3', 'eleven_turbo_v3', 'eleven_multilingual_v3'],
  },
  {
    modelId: 'eleven_flash_v2_5',
    labelKey: 'audio.model.elevenV25',
    matchIds: ['eleven_flash_v2_5', 'eleven_v2_5_flash', 'eleven_turbo_v2_5'],
  },
  {
    modelId: 'autoai_speech_1',
    labelKey: 'audio.model.autoTtsV1',
    matchIds: [
      'autoai_speech_1',
      'eleven_multilingual_v2',
      'eleven_flash_v2',
      'eleven_v2_flash',
      'eleven_turbo_v2',
    ],
  },
];

/** Catalog OpenVoice (omnivoice_local) — khớp vmedia.ai. */
export const OPENVOICE_MODEL_CATALOG: TtsModelOption[] = [
  {
    modelId: 'omnivoice_v1',
    labelKey: 'audio.model.omnivoice',
    matchIds: ['omnivoice_v1', 'vmedia_fast_v1_1', 'vmedia_fast_v1', 'omnivoice_fast'],
  },
  {
    modelId: 'vmedia_fast_v1_1',
    labelKey: 'audio.model.openvoiceFast',
    matchIds: ['vmedia_fast_v1_1', 'vmedia_fast_v1', 'omnivoice_fast'],
  },
];

/** Catalog Minimax — khớp vmedia.ai + fallback legacy. */
export const MINIMAX_MODEL_CATALOG: TtsModelOption[] = [
  {
    modelId: 'minimax_speech_2_8_hd',
    labelKey: 'audio.model.minimax28Hd',
    matchIds: ['minimax_speech_2_8_hd'],
  },
  {
    modelId: 'minimax_speech_2_8_turbo',
    labelKey: 'audio.model.minimax28Turbo',
    matchIds: ['minimax_speech_2_8_turbo'],
  },
  {
    modelId: 'minimax_speech_2_6_hd',
    labelKey: 'audio.model.minimax26Hd',
    matchIds: ['minimax_speech_2_6_hd'],
  },
  {
    modelId: 'minimax_speech_2_6_turbo',
    labelKey: 'audio.model.minimax26Turbo',
    matchIds: ['minimax_speech_2_6_turbo'],
  },
  {
    modelId: 'speech-02-turbo',
    labelKey: 'audio.model.minimaxTurbo',
    matchIds: ['speech-02-turbo', 'speech-02-hd', 'speech-01-turbo'],
  },
];

export interface TtsLanguageOption {
  value: string;
  labelKey: TranslationKey;
}

/** Ngôn ngữ cố định — khớp vmedia.ai (không lấy từ verified_languages). */
export const TTS_LANGUAGE_OPTIONS: TtsLanguageOption[] = [
  { value: 'auto', labelKey: 'audio.lang.auto' },
  { value: 'vi', labelKey: 'audio.lang.vi' },
  { value: 'en', labelKey: 'audio.lang.en' },
  { value: 'zh', labelKey: 'audio.lang.zh' },
  { value: 'ja', labelKey: 'audio.lang.ja' },
  { value: 'ko', labelKey: 'audio.lang.ko' },
];

function supportedModelIds(voice: VoiceItem | null): Set<string> {
  const ids = new Set<string>();
  if (voice?.verified_languages?.length) {
    for (const v of voice.verified_languages) {
      if (v.model_id) ids.add(v.model_id);
    }
  }
  return ids;
}

function resolveModelId(entry: TtsModelOption, supported: Set<string>): string {
  if (supported.has(entry.modelId)) return entry.modelId;
  for (const id of entry.matchIds) {
    if (supported.has(id)) return id;
  }
  return entry.modelId;
}

/** GenMax cheap (elevenlabs_cheap) — turbo không được hỗ trợ, dùng flash (khớp vmedia). */
export function normalizeElevenLabsCheapModel(modelId: string): string {
  const map: Record<string, string> = {
    eleven_turbo_v2_5: 'eleven_flash_v2_5',
    eleven_v2_5_flash: 'eleven_flash_v2_5',
    eleven_turbo_v2: 'eleven_flash_v2',
    eleven_v2_flash: 'eleven_flash_v2',
  };
  return map[modelId] ?? modelId;
}

/** Model dropdown cho ElevenLabs — lọc theo voice, dedupe theo modelId+label. */
function modelsForVoiceFromCatalog(
  voice: VoiceItem | null,
  catalog: TtsModelOption[],
): Array<TtsModelOption & { resolvedId: string }> {
  const supported = supportedModelIds(voice);
  const hasSupport = supported.size > 0;

  const out: Array<TtsModelOption & { resolvedId: string }> = [];
  const seen = new Set<string>();

  for (const entry of catalog) {
    const applicable = !hasSupport || entry.matchIds.some((id) => supported.has(id));
    if (!applicable) continue;

    const resolvedId = hasSupport ? resolveModelId(entry, supported) : entry.modelId;
    const key = `${entry.labelKey}:${resolvedId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({ ...entry, resolvedId });
  }

  if (out.length) return out;

  return catalog.slice(0, 1).map((entry) => ({
    ...entry,
    resolvedId: entry.modelId,
  }));
}

/** ElevenLabs — luôn hiện full catalog (vmedia không lọc theo verified_languages). */
export function elevenLabsModelsForVoice(_voice: VoiceItem | null): Array<TtsModelOption & { resolvedId: string }> {
  return ELEVENLABS_MODEL_CATALOG.map((entry) => ({
    ...entry,
    resolvedId: entry.modelId,
  }));
}

export function openVoiceModelsForVoice(voice: VoiceItem | null): Array<TtsModelOption & { resolvedId: string }> {
  return modelsForVoiceFromCatalog(voice, OPENVOICE_MODEL_CATALOG);
}

export function minimaxModelsForVoice(voice: VoiceItem | null): Array<TtsModelOption & { resolvedId: string }> {
  return modelsForVoiceFromCatalog(voice, MINIMAX_MODEL_CATALOG);
}

export function ttsModelsForProvider(
  voice: VoiceItem | null,
  provider: 'elevenlabs_cheap' | 'minimaxai_cheap' | 'omnivoice_local',
): Array<TtsModelOption & { resolvedId: string }> {
  switch (provider) {
    case 'minimaxai_cheap':
      return minimaxModelsForVoice(voice);
    case 'omnivoice_local':
      return openVoiceModelsForVoice(voice);
    default:
      return elevenLabsModelsForVoice(voice);
  }
}

export function defaultTtsModelId(
  voice: VoiceItem | null,
  provider: 'elevenlabs_cheap' | 'minimaxai_cheap' | 'omnivoice_local',
): string {
  const list = ttsModelsForProvider(voice, provider);
  if (list[0]?.resolvedId) return list[0].resolvedId;
  switch (provider) {
    case 'omnivoice_local':
      return 'omnivoice_v1';
    case 'minimaxai_cheap':
      return 'minimax_speech_2_8_turbo';
    default:
      return 'eleven_v3';
  }
}
