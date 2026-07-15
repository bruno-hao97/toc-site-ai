import { GOMMO_AUTH_BASE, GOMMO_AUTH_PATH, UpstreamMeError } from './upstreamMe';
import { clearAuth, loadAuth, resolveProjectId } from './authStore';
import { GOMMO_CHAT_CONFIG } from './gommoChatConfig';
import type { AppLocale } from '../i18n/types';
import { normalizeElevenLabsCheapModel } from './audioCatalog';

export type VoiceProvider = 'elevenlabs_cheap' | 'minimaxai_cheap' | 'omnivoice_local';

export interface VerifiedLanguage {
  language?: string;
  model_id?: string;
  accent?: string;
  locale?: string;
}

export interface VoiceItem {
  voice_id: string;
  id_base?: string;
  name: string;
  description?: string;
  preview_url?: string;
  labels?: Record<string, string>;
  server?: string;
  price?: number;
  type?: string;
  status?: string;
  free_users_allowed?: boolean;
  verified_languages?: VerifiedLanguage[];
}

export interface SearchVoicesResult {
  voices: VoiceItem[];
  hasMore: boolean;
  raw?: unknown;
}

export interface AudioInfo {
  text?: string;
  status?: string;
  id_base?: string;
  duration?: number;
  file_url?: string;
  result_url?: string;
  url?: string;
  server?: string;
  voice_id?: string;
  price?: number;
  model?: string;
}

export interface CreateAudioResult {
  fileUrl: string;
  audioInfo: AudioInfo;
  raw: Record<string, unknown>;
}

export interface AudioListItem {
  text: string;
  text_length?: number;
  status: string;
  id_base: string;
  duration?: number;
  sound_type?: string;
  file_size?: number;
  file_url: string;
  source_audio_url?: string | null;
  server?: string;
  voice_id?: string;
  project_id?: string;
  price?: number;
  model?: string;
  created_at: string;
}

const AUDIO_URLS = [
  `${GOMMO_AUTH_BASE}/ai/audio`,
  `${GOMMO_AUTH_BASE}${GOMMO_AUTH_PATH}/ai/audio`,
];

export function buildDeviceInfo(locale: AppLocale): string {
  if (typeof window === 'undefined') {
    return JSON.stringify({
      language: locale,
      platform: 'web',
      app: GOMMO_CHAT_CONFIG.deviceName,
    });
  }

  const nav = navigator;
  const screenInfo = window.screen;
  const navExt = nav as Navigator & { deviceMemory?: number };

  return JSON.stringify({
    language: locale,
    platform: nav.platform || 'web',
    app: GOMMO_CHAT_CONFIG.deviceName,
    userAgent: nav.userAgent,
    vendor: nav.vendor,
    languages: nav.languages ? [...nav.languages] : [locale],
    cookieEnabled: nav.cookieEnabled,
    onLine: nav.onLine,
    hardwareConcurrency: nav.hardwareConcurrency,
    deviceMemory: navExt.deviceMemory,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screen: {
      width: screenInfo.width,
      height: screenInfo.height,
      availWidth: screenInfo.availWidth,
      availHeight: screenInfo.availHeight,
      colorDepth: screenInfo.colorDepth,
      pixelDepth: screenInfo.pixelDepth,
    },
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
  });
}

function providerFields(server: VoiceProvider, page: number, query?: string): Record<string, string> {
  const q = query?.trim();
  switch (server) {
    case 'elevenlabs_cheap':
      return {
        sort: 'created_date',
        page_size: '100',
        page: String(page),
        ...(q ? { search: q } : {}),
      };
    case 'minimaxai_cheap':
      return {
        type: 'system',
        'filters[explore]': 'public',
        limit: '500',
        page: String(page + 1),
        ...(q ? { search: q } : {}),
      };
    case 'omnivoice_local':
      return {
        type: 'public',
        limit: '500',
        page: String(page + 1),
        ...(q ? { search: q } : {}),
      };
    default:
      return {};
  }
}

type VoiceListPagination = { page?: number; pages?: number };

type VoiceDataEnvelope = {
  items?: VoiceItem[];
  pagination?: VoiceListPagination;
  success?: boolean;
};

function paginationHasMore(pagination: VoiceListPagination | undefined): boolean {
  if (!pagination) return false;
  const { page, pages } = pagination;
  if (page != null && pages != null) return page < pages;
  return false;
}

function parseVoicesEnvelope(parsed: Record<string, unknown>): SearchVoicesResult {
  const dataRaw = parsed.data;
  if (dataRaw && typeof dataRaw === 'object' && !Array.isArray(dataRaw)) {
    const dataBlock = dataRaw as VoiceDataEnvelope;
    if (Array.isArray(dataBlock.items)) {
      return {
        voices: dataBlock.items.map(normalizeVoice),
        hasMore: paginationHasMore(dataBlock.pagination),
        raw: parsed,
      };
    }
  }

  const genmaxSync = parsed.genmax_sync as { items?: VoiceItem[] } | undefined;
  if (Array.isArray(genmaxSync?.items) && genmaxSync.items.length) {
    return {
      voices: genmaxSync.items.map(normalizeVoice),
      hasMore: false,
      raw: parsed,
    };
  }

  const genmax = parsed.genmax as { items?: VoiceItem[] } | undefined;
  if (Array.isArray(genmax?.items) && genmax.items.length) {
    const voicesBlock = parsed.voices as { data?: { has_more?: boolean } } | undefined;
    return {
      voices: genmax.items.map(normalizeVoice),
      hasMore: Boolean(voicesBlock?.data?.has_more),
      raw: parsed,
    };
  }

  const voicesBlock = parsed.voices as {
    data?: { voices?: VoiceItem[]; has_more?: boolean };
  } | undefined;
  const list = voicesBlock?.data?.voices;
  if (Array.isArray(list) && list.length) {
    return {
      voices: list.map(normalizeVoice),
      hasMore: Boolean(voicesBlock?.data?.has_more),
      raw: parsed,
    };
  }

  if (Array.isArray(dataRaw)) {
    return { voices: (dataRaw as VoiceItem[]).map(normalizeVoice), hasMore: false, raw: parsed };
  }

  return { voices: [], hasMore: false, raw: parsed };
}

function normalizeVoice(v: VoiceItem): VoiceItem {
  return {
    ...v,
    voice_id: v.voice_id || v.id_base || '',
    id_base: v.id_base || v.voice_id,
  };
}

function extractAudioFileUrl(audioInfo?: AudioInfo | null): string | null {
  if (!audioInfo) return null;
  return audioInfo.file_url || audioInfo.result_url || audioInfo.url || null;
}

async function postAudioApi(body: URLSearchParams): Promise<Record<string, unknown>> {
  let lastErr: Error | null = null;

  for (const url of AUDIO_URLS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (res.status === 401 || res.status === 403) {
        clearAuth();
        if (typeof window !== 'undefined') window.location.href = '/login';
        throw new UpstreamMeError('Phiên đăng nhập hết hạn', res.status);
      }

      const text = await res.text();
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(text) as Record<string, unknown>;
      } catch {
        throw new UpstreamMeError(text || `HTTP ${res.status}`, res.status);
      }

      const dataBlock = parsed.data as { success?: boolean } | undefined;
      const failed =
        parsed.success === false ||
        (dataBlock && typeof dataBlock === 'object' && dataBlock.success === false);

      if (!res.ok || failed) {
        throw new UpstreamMeError(
          (parsed.message as string) || `HTTP ${res.status}`,
          res.status,
        );
      }

      return parsed;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastErr ?? new UpstreamMeError('Không gọi được audio API');
}

function baseAudioFields(locale: AppLocale, projectId?: string): URLSearchParams {
  const auth = loadAuth();
  if (!auth?.access_token) throw new UpstreamMeError('Chưa đăng nhập', 401);

  return new URLSearchParams({
    access_token: auth.access_token.trim(),
    domain: auth.domain.trim(),
    project_id: resolveProjectId(projectId || auth.projectId),
    device_id: GOMMO_CHAT_CONFIG.deviceId,
    device_name: GOMMO_CHAT_CONFIG.deviceName,
    device_info: buildDeviceInfo(locale),
  });
}

export async function searchVoices(opts: {
  server: VoiceProvider;
  locale: AppLocale;
  page?: number;
  query?: string;
  projectId?: string;
}): Promise<SearchVoicesResult> {
  const page = opts.page ?? 0;
  const body = baseAudioFields(opts.locale, opts.projectId);
  body.set('action_type', 'searchVoices');
  body.set('server', opts.server);
  for (const [key, value] of Object.entries(providerFields(opts.server, page, opts.query))) {
    body.set(key, value);
  }

  const parsed = await postAudioApi(body);
  return parseVoicesEnvelope(parsed);
}

export async function createAudio(opts: {
  text: string;
  voiceId: string;
  voiceName?: string;
  server: VoiceProvider;
  model: string;
  language?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
  speed?: number;
  pitch?: number;
  volume?: number;
  quality?: number;
  styleGuide?: string;
  denormalize?: boolean;
  postProcess?: boolean;
  pitchOptimize?: boolean;
  locale: AppLocale;
  projectId?: string;
}): Promise<CreateAudioResult> {
  const body = baseAudioFields(opts.locale, opts.projectId);
  body.set('action_type', 'create');
  body.set('text', opts.text.trim());
  body.set('voice_id', opts.voiceId);
  body.set('server', opts.server);
  const model =
    opts.server === 'elevenlabs_cheap'
      ? normalizeElevenLabsCheapModel(opts.model)
      : opts.model;
  body.set('model', model);

  const voiceName = opts.voiceName?.trim();
  if (voiceName) {
    body.set('voice_name', voiceName);
  }

  const isOpenVoiceStyle =
    opts.server === 'omnivoice_local' || opts.server === 'minimaxai_cheap';
  if (isOpenVoiceStyle) {
    body.set('audio_type', 'standard');
  }

  const lang = opts.language?.trim();
  if (lang && lang !== 'auto') {
    body.set('language', lang);
  }

  const settingKey = isOpenVoiceStyle ? 'voice_setting' : 'voice_settings';

  if (opts.stability != null) {
    body.set(`${settingKey}[stability]`, String(opts.stability));
  }
  if (opts.similarityBoost != null) {
    body.set(`${settingKey}[similarity_boost]`, String(opts.similarityBoost));
  }
  if (!isOpenVoiceStyle && opts.style != null && opts.style > 0) {
    body.set(`${settingKey}[style]`, String(opts.style));
  }
  if (!isOpenVoiceStyle && opts.useSpeakerBoost != null) {
    body.set(`${settingKey}[use_speaker_boost]`, opts.useSpeakerBoost ? 'true' : 'false');
  }

  if (opts.speed != null) {
    body.set(`${settingKey}[speed]`, String(opts.speed));
  }
  if (opts.pitch != null) {
    body.set(`${settingKey}[pitch]`, String(opts.pitch));
  }
  if (opts.volume != null) {
    body.set(`${settingKey}[volume]`, String(opts.volume));
  }
  if (opts.quality != null) {
    body.set(`${settingKey}[quality]`, String(opts.quality));
  }
  if (opts.styleGuide?.trim()) {
    body.set(`${settingKey}[style]`, opts.styleGuide.trim());
  }
  if (opts.denormalize != null) {
    body.set(`${settingKey}[denormalize]`, opts.denormalize ? '1' : '0');
  }
  if (opts.postProcess != null) {
    body.set(`${settingKey}[post_process]`, opts.postProcess ? '1' : '0');
  }
  if (opts.pitchOptimize != null) {
    body.set(`${settingKey}[pitch_optimize]`, opts.pitchOptimize ? '1' : '0');
  }

  const parsed = await postAudioApi(body);
  const audioInfo = (parsed.audioInfo as AudioInfo | undefined) ?? {};
  const fileUrl = extractAudioFileUrl(audioInfo);

  if (!fileUrl) {
    throw new UpstreamMeError(
      (parsed.message as string) || 'Không nhận được file audio từ server',
    );
  }

  return { fileUrl, audioInfo, raw: parsed };
}

export async function getAudioLists(opts: {
  locale: AppLocale;
  projectId?: string;
}): Promise<AudioListItem[]> {
  const body = baseAudioFields(opts.locale, opts.projectId);
  body.set('action_type', 'getLists');
  const parsed = await postAudioApi(body);
  const data = parsed.data;
  if (!Array.isArray(data)) return [];
  return (data as AudioListItem[]).filter((item) => item?.file_url && item?.id_base);
}

export function voiceLanguages(voice: VoiceItem | null): VerifiedLanguage[] {
  if (!voice?.verified_languages?.length) {
    const lang = voice?.labels?.language;
    if (lang) return [{ language: lang, locale: voice.labels?.locale }];
    return [{ language: 'en', locale: 'en-US' }];
  }
  return voice.verified_languages;
}

export function voiceModels(voice: VoiceItem | null): string[] {
  const ids = new Set<string>();
  for (const v of voiceLanguages(voice)) {
    if (v.model_id) ids.add(v.model_id);
  }
  if (!ids.size && voice?.labels?.language) {
    ids.add('eleven_multilingual_v2');
  }
  return [...ids];
}

export function providerLabelKey(server: VoiceProvider): 'audio.provider.elevenlabs' | 'audio.provider.minimax' | 'audio.provider.openvoice' {
  switch (server) {
    case 'minimaxai_cheap':
      return 'audio.provider.minimax';
    case 'omnivoice_local':
      return 'audio.provider.openvoice';
    default:
      return 'audio.provider.elevenlabs';
  }
}
