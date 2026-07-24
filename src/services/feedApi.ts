import { GOMMO_AUTH_BASE, GOMMO_AUTH_PATH, UpstreamMeError } from './upstreamMe';
import { authUserKey, clearAuth, isAdminUser, loadAuth, resolveProjectId } from './authStore';
import { GOMMO_CHAT_CONFIG } from './gommoChatConfig';
import { buildDeviceInfo } from './audioVoices';
import { usesPlatformJobs } from './platformJobClient';
import { PLATFORM_BRIDGE } from './platformBridge';
import { listHistory, type HistoryEntry } from './historyStore';

/**
 * GET feed qua PHP bridge cho user thường (chỉ có platform_token).
 * Server tự chèn access_token admin dùng chung — user không cần token Gommo.
 */
async function platformFeedGet<T extends { success?: boolean; message?: string }>(
  baseUrl: string,
  params: Record<string, string>,
): Promise<T> {
  const auth = loadAuth();
  const token = auth?.platform_token?.trim();
  if (!token) throw new UpstreamMeError('Chưa đăng nhập tài khoản hệ thống', 401);
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${baseUrl}?${qs}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  return parseFeedRes<T>(res);
}

async function feedRequest<T extends { success?: boolean; message?: string }>(
  gommoUrl: string,
  fields: Record<string, string>,
): Promise<T> {
  const auth = loadAuth();
  const token = auth?.platform_token?.trim() || auth?.access_token?.trim();
  if (!token) throw new UpstreamMeError('Chưa đăng nhập', 401);
  const body = new URLSearchParams({
    domain: auth?.domain?.trim() || 'vmedia.ai',
    ...fields,
  }).toString();
  const res = await fetch(gommoUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  return parseFeedRes<T>(res);
}

async function parseFeedRes<T extends { success?: boolean; message?: string }>(
  res: Response,
): Promise<T> {
  // Token (Gommo hoặc JWT backend) hết hạn → đăng xuất, về trang login.
  if (res.status === 401 || res.status === 403) {
    clearAuth();
    if (typeof window !== 'undefined') window.location.href = '/login';
  }
  const text = await res.text();
  let parsed: T;
  try {
    parsed = JSON.parse(text) as T;
  } catch {
    const isHtml = /^\s*</.test(text) || /<!doctype|<br\s*\/?>|<b>Fatal/i.test(text);
    throw new UpstreamMeError(
      isHtml
        ? 'Gateway tạm thời lỗi. Thử lại sau hoặc liên hệ hỗ trợ.'
        : text.slice(0, 200) || `HTTP ${res.status}`,
      res.status,
    );
  }
  if (!res.ok || parsed.success === false) {
    throw new UpstreamMeError(parsed.message || `HTTP ${res.status}`, res.status);
  }
  const softErr = (parsed as { error?: number }).error;
  if (typeof softErr === 'number' && softErr !== 0) {
    throw new UpstreamMeError(parsed.message || `Upstream error ${softErr}`, res.status);
  }
  return parsed;
}

export interface FeedResolution {
  type: string;
  status?: string;
  id_base?: string;
  url?: string;
  name?: string;
  value?: string;
  width?: number;
  height?: number;
  ratio?: string;
}

export interface FeedImageRef {
  url: string;
  file_name?: string;
  created_time?: number;
}

export interface FeedAuthor {
  name?: string;
  id_base?: string;
  avatar?: string;
  username?: string;
}

export interface FeedModelInfo {
  id_base?: string;
  name?: string;
  model?: string;
}

export interface FeedItem {
  id_base: string;
  type: 'video' | 'image' | string;
  status: string;
  model?: string;
  modelInfo?: FeedModelInfo;
  mode?: string;
  ratio?: string;
  resolution?: string;
  quality?: string | number;
  duration?: string;
  title?: string;
  resolutions?: FeedResolution[];
  images?: FeedImageRef[];
  objects?: FeedImageRef[];
  download_url?: string;
  thumbnail_url?: string;
  thumbnail_end_url?: string;
  url_preview?: string;
  url?: string;
  prompt?: string;
  credit_fee?: number;
  like_count?: number;
  likes_count?: number;
  comments_count?: number;
  created_time?: string | number;
  author?: FeedAuthor;
  isMe?: boolean;
  file_size?: number;
  category_name?: string;
  server_ai?: string;
  /** TTS: voice id lưu từ meta job / history */
  voice_id?: string;
}

export interface FeedPage {
  items: FeedItem[];
  nextAfterVideoId: string;
  nextAfterImageId: string;
}

interface FeedResponse {
  success?: boolean;
  message?: string;
  data?: FeedItem[];
  next_after_video_id?: string;
  next_after_image_id?: string;
  runtime?: number;
}

export interface FetchFeedParams {
  limit?: number;
  privacy?: string;
  projectId?: string;
  afterVideoId?: string;
  afterImageId?: string;
}

export async function fetchNewsfeed(params: FetchFeedParams = {}): Promise<FeedPage> {
  const {
    limit = 30,
    privacy = 'PUBLIC',
    projectId = 'default',
    afterVideoId = '',
    afterImageId = '',
  } = params;

  let parsed: FeedResponse;
  if (usesPlatformJobs()) {
    const q: Record<string, string> = { limit: String(limit), privacy };
    if (afterVideoId) q.after_video_id = afterVideoId;
    if (afterImageId) q.after_image_id = afterImageId;
    parsed = await platformFeedGet<FeedResponse>(PLATFORM_BRIDGE.newfeeds, q);
  } else {
    const fields: Record<string, string> = {
      limit: String(limit),
      project_id: projectId,
      privacy,
    };
    if (afterVideoId) fields.after_video_id = afterVideoId;
    if (afterImageId) fields.after_image_id = afterImageId;
    parsed = await feedRequest<FeedResponse>(`${GOMMO_AUTH_BASE}/ai/newfeeds`, fields);
  }

  return {
    items: parsed.data ?? [],
    nextAfterVideoId: parsed.next_after_video_id ?? '',
    nextAfterImageId: parsed.next_after_image_id ?? '',
  };
}

interface PublicVideosResponse {
  success?: boolean;
  message?: string;
  data?: FeedItem[];
  next_after_id?: string;
  after_id?: string;
}

export interface PublicVideosPage {
  items: FeedItem[];
  nextAfterId: string;
}

export interface FetchPublicVideosParams {
  type?: string;
  publicPrompt?: boolean;
  limit?: number;
  afterId?: string;
}

export async function fetchPublicVideos(params: FetchPublicVideosParams = {}): Promise<PublicVideosPage> {
  const {
    type = 'public_home',
    publicPrompt = false,
    limit = 30,
    afterId = '',
  } = params;

  let parsed: PublicVideosResponse;
  if (usesPlatformJobs()) {
    const q: Record<string, string> = {
      type,
      public_prompt: String(publicPrompt),
      limit: String(limit),
    };
    if (afterId) q.after_id = afterId;
    parsed = await platformFeedGet<PublicVideosResponse>(PLATFORM_BRIDGE.publicVideos, q);
  } else {
    const fields: Record<string, string> = {
      type,
      public_prompt: String(publicPrompt),
      limit: String(limit),
    };
    if (afterId) fields.after_id = afterId;
    parsed = await feedRequest<PublicVideosResponse>(
      `${GOMMO_AUTH_PATH}/ai/public-videos`,
      fields,
    );
  }

  const items = parsed.data ?? [];
  const last = items.length ? items[items.length - 1] : undefined;
  const nextAfterId = parsed.next_after_id ?? parsed.after_id ?? last?.id_base ?? '';

  return { items, nextAfterId };
}

export interface MinePage {
  items: FeedItem[];
  nextAfterId: string;
}

export interface FetchMineParams {
  limit?: number;
  afterId?: string;
}

interface MineVideosResponse {
  success?: boolean;
  message?: string;
  data?: FeedItem[];
  next_after_id?: string;
}

interface MyImageResolution {
  name?: string;
  value?: string;
  width?: number;
  height?: number;
  ratio?: string;
}

interface MyImageItem {
  id_base: string;
  url?: string;
  url_preview?: string;
  prompt?: string;
  model?: string;
  ratio?: string;
  resolution?: string;
  status?: string;
  created_at?: number | string;
  isMe?: boolean;
  resolutions?: MyImageResolution[];
  server_ai?: string;
  category_name?: string;
  file_size?: number;
}

function gommoDeviceFields(): Record<string, string> {
  return {
    device_id: GOMMO_CHAT_CONFIG.deviceId,
    device_name: GOMMO_CHAT_CONFIG.deviceName,
    device_info: buildDeviceInfo('vi'),
  };
}

function mineFields(extra: Record<string, string>): Record<string, string> {
  const fields = { ...extra, ...gommoDeviceFields() };
  const projectId = resolveProjectId();
  if (projectId && projectId !== 'default') {
    fields.project_id = projectId;
  }
  return fields;
}

interface MineImagesResponse {
  success?: boolean;
  message?: string;
  data?: MyImageItem[];
  next_after_id?: string;
}

function mapImageToFeedItem(img: MyImageItem): FeedItem {
  const resolutions = img.resolutions?.map((r) => ({
    type: r.name || r.value || 'image',
    name: r.name,
    value: r.value,
    width: r.width,
    height: r.height,
    ratio: r.ratio,
    status: 'FINISH',
    url: img.url,
  }));
  const resolutionName = img.resolutions?.[0]?.name || img.resolutions?.[0]?.value;
  return {
    id_base: img.id_base,
    type: 'image',
    status: img.status || 'SUCCESS',
    prompt: img.prompt,
    model: img.model,
    ratio: img.ratio || img.resolutions?.[0]?.ratio,
    resolution: resolutionName || img.resolution,
    resolutions,
    thumbnail_url: img.url_preview || img.url,
    download_url: img.url,
    created_time: img.created_at,
    isMe: img.isMe,
    file_size: img.file_size,
    category_name: img.category_name,
    server_ai: img.server_ai,
  };
}

export type MineJobType = 'image' | 'video' | 'music' | 'tts';

export async function fetchMyVideos(params: FetchMineParams = {}): Promise<MinePage> {
  if (usesPlatformJobs()) {
    return fetchPlatformMine('video', params);
  }
  const { limit = 30, afterId = '' } = params;
  const fields = mineFields({
    limit: String(limit),
    order_by: 'index',
    sort_by: 'desc',
  });
  if (afterId) fields.after_id = afterId;

  const parsed = await feedRequest<MineVideosResponse>(
    `${GOMMO_AUTH_BASE}/ai/videos`,
    fields,
  );

  const items = (parsed.data ?? []).map((it) => mapVideoToFeedItem(it));
  const last = items.length ? items[items.length - 1] : undefined;
  return { items, nextAfterId: parsed.next_after_id ?? last?.id_base ?? '' };
}

export async function fetchMyImages(params: FetchMineParams = {}): Promise<MinePage> {
  if (usesPlatformJobs()) {
    return fetchPlatformMine('image', params);
  }
  const { limit = 30, afterId = '' } = params;
  const fields = mineFields({
    limit: String(limit),
    order_by: 'index',
    sort_by: 'desc',
  });
  if (afterId) fields.after_id = afterId;

  const parsed = await feedRequest<MineImagesResponse>(
    `${GOMMO_AUTH_BASE}/ai/images`,
    fields,
  );

  const raw = parsed.data ?? [];
  const items = raw.map(mapImageToFeedItem);
  const last = raw.length ? raw[raw.length - 1] : undefined;
  return { items, nextAfterId: parsed.next_after_id ?? last?.id_base ?? '' };
}

function feedItemTime(item: FeedItem): number {
  const v = item.created_time;
  const n = typeof v === 'string' ? Number(v) : v ?? 0;
  return Number.isFinite(n) ? Number(n) : 0;
}

function paginateFeedItems(all: FeedItem[], params: FetchMineParams): MinePage {
  const { limit = 30, afterId = '' } = params;
  const sorted = [...all].sort((a, b) => feedItemTime(b) - feedItemTime(a));
  let start = 0;
  if (afterId) {
    const idx = sorted.findIndex((e) => e.id_base === afterId);
    start = idx >= 0 ? idx + 1 : 0;
  }
  const slice = sorted.slice(start, start + limit);
  const last = slice.length ? slice[slice.length - 1] : undefined;
  const nextAfterId =
    slice.length === limit && last && start + limit < sorted.length ? last.id_base : '';
  return { items: slice, nextAfterId };
}

function dedupeFeedItems(items: FeedItem[]): FeedItem[] {
  const byId = new Map<string, FeedItem>();
  const byUrl = new Map<string, string>();
  for (const it of items) {
    if (!it.id_base) continue;
    const url = (it.download_url || it.resolutions?.[0]?.url || '').trim();
    if (url) {
      const existingId = byUrl.get(url);
      if (existingId && existingId !== it.id_base) continue;
      byUrl.set(url, it.id_base);
    }
    if (!byId.has(it.id_base)) byId.set(it.id_base, it);
  }
  return [...byId.values()];
}

async function collectPlatformMine(type: MineJobType, maxPages = 5): Promise<FeedItem[]> {
  const out: FeedItem[] = [];
  let afterId = '';
  for (let i = 0; i < maxPages; i++) {
    const page = await fetchPlatformMine(type, { limit: 50, afterId });
    out.push(...page.items);
    if (!page.nextAfterId || page.nextAfterId === afterId) break;
    afterId = page.nextAfterId;
  }
  return out;
}

type AudioMusicCache = { userKey: string; at: number; items: FeedItem[] };
const audioFeedCache: { current: AudioMusicCache | null } = { current: null };
const musicFeedCache: { current: AudioMusicCache | null } = { current: null };
const AUDIO_MUSIC_CACHE_MS = 20_000;

export function invalidateMineAudioMusicCaches(): void {
  audioFeedCache.current = null;
  musicFeedCache.current = null;
}

function cacheMatchesUser(cache: AudioMusicCache | null): cache is AudioMusicCache {
  return Boolean(cache && cache.userKey === authUserKey());
}

/** Job nhạc AI — platform job-list theo user + local history (scoped user). */
export async function fetchMyMusic(params: FetchMineParams = {}): Promise<MinePage> {
  const now = Date.now();
  const userKey = authUserKey();
  if (
    !params.afterId
    && cacheMatchesUser(musicFeedCache.current)
    && now - musicFeedCache.current.at < AUDIO_MUSIC_CACHE_MS
  ) {
    return paginateFeedItems(musicFeedCache.current.items, params);
  }
  if (params.afterId && cacheMatchesUser(musicFeedCache.current)) {
    return paginateFeedItems(musicFeedCache.current.items, params);
  }

  const chunks: FeedItem[] = listHistory('music').map(historyEntryToFeedItem);
  if (usesPlatformJobs()) {
    try {
      chunks.push(...(await collectPlatformMine('music')));
    } catch {
      // giữ history
    }
  }
  const items = dedupeFeedItems(chunks);
  musicFeedCache.current = { userKey, at: now, items };
  return paginateFeedItems(items, params);
}

/**
 * Job âm thanh / TTS — chỉ job của user (job-list) + local history scoped.
 * Không dùng Gommo getLists (token merchant chung).
 */
export async function fetchMyAudio(params: FetchMineParams = {}): Promise<MinePage> {
  const now = Date.now();
  const userKey = authUserKey();
  if (
    !params.afterId
    && cacheMatchesUser(audioFeedCache.current)
    && now - audioFeedCache.current.at < AUDIO_MUSIC_CACHE_MS
  ) {
    return paginateFeedItems(audioFeedCache.current.items, params);
  }
  if (params.afterId && cacheMatchesUser(audioFeedCache.current)) {
    return paginateFeedItems(audioFeedCache.current.items, params);
  }

  const chunks: FeedItem[] = listHistory('tts').map(historyEntryToFeedItem);

  if (usesPlatformJobs()) {
    try {
      chunks.push(...(await collectPlatformMine('tts')));
    } catch {
      // ignore
    }
  }

  const items = dedupeFeedItems(chunks);
  audioFeedCache.current = { userKey, at: now, items };
  return paginateFeedItems(items, params);
}

/** Ghi TTS/music đã xong vào platform_jobs của user (không trừ credit). */
export async function recordPlatformJob(input: {
  type: 'tts' | 'music';
  resultUrl: string;
  modelId: string;
  prompt?: string;
  costCredits?: number;
  providerJobId?: string;
  meta?: Record<string, string>;
}): Promise<string> {
  const auth = loadAuth();
  const token = auth?.platform_token?.trim();
  if (!token) throw new UpstreamMeError('Chưa đăng nhập tài khoản hệ thống', 401);

  const res = await fetch(PLATFORM_BRIDGE.jobRecord, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      type: input.type,
      modelId: input.modelId,
      resultUrl: input.resultUrl,
      prompt: input.prompt || '',
      costCredits: input.costCredits ?? 0,
      providerJobId: input.providerJobId || '',
      meta: input.meta || {},
    }),
  });
  if (res.status === 401 || res.status === 403) {
    clearAuth();
    if (typeof window !== 'undefined') window.location.href = '/login';
  }
  const text = await res.text();
  let parsed: { success?: boolean; message?: string; data?: { platformJobId?: string } };
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    throw new UpstreamMeError(text || `HTTP ${res.status}`, res.status);
  }
  if (!res.ok || parsed.success === false || !parsed.data?.platformJobId) {
    throw new UpstreamMeError(parsed.message || 'Ghi job thất bại', res.status);
  }
  invalidateMineAudioMusicCaches();
  return parsed.data.platformJobId;
}

function historyEntryToFeedItem(entry: HistoryEntry): FeedItem {
  const url = (entry.resultUrl || '').trim();
  const feedType = entry.type;
  const cover = (entry.meta?.coverUrl || entry.meta?.cover_url || '').trim();
  const visualThumb =
    feedType === 'image' || feedType === 'video' || feedType === 'avatar-lipsync'
      ? url || undefined
      : cover || undefined;
  const voiceId = (entry.meta?.voice_id || entry.meta?.voiceId || '').trim();
  const server = (entry.meta?.server || entry.meta?.provider || '').trim();
  return {
    id_base: entry.id,
    type: feedType,
    status: url ? 'FINISH' : 'processing',
    prompt: entry.prompt || undefined,
    model: entry.modelSlug || entry.modelName || undefined,
    download_url: url || undefined,
    thumbnail_url: visualThumb,
    created_time: entry.createdAt
      ? Math.floor(new Date(entry.createdAt).getTime() / 1000)
      : undefined,
    duration: entry.meta?.duration || undefined,
    voice_id: voiceId || undefined,
    server_ai: server || undefined,
    resolutions: url
      ? [{ type: feedType, status: 'FINISH', url }]
      : undefined,
  };
}

interface PlatformJobListItem {
  id: string;
  providerJobId?: string | null;
  jobType: string;
  modelId: string;
  status: string;
  resultUrl?: string | null;
  prompt?: string | null;
  ratio?: string | null;
  resolution?: string | null;
  mode?: string | null;
  coverUrl?: string | null;
  voiceId?: string | null;
  server?: string | null;
  duration?: string | number | null;
  fileSize?: number | null;
  costCredits?: number;
  createdTime?: number | null;
}

function platformFeedType(jobType: string): string {
  const t = (jobType || '').toLowerCase();
  if (t === 'video' || t === 'avatar-lipsync') return t === 'avatar-lipsync' ? 'video' : 'video';
  if (t === 'image' || t === 'image-upscale' || t === 'remove-bg') return 'image';
  if (t === 'music') return 'music';
  if (t === 'tts' || t.includes('audio')) return 'tts';
  return t || 'image';
}

function platformJobToFeedItem(job: PlatformJobListItem): FeedItem {
  const url = (job.resultUrl || '').trim();
  const cover = (job.coverUrl || '').trim();
  const feedType = platformFeedType(job.jobType);
  const isVisual = feedType === 'video' || feedType === 'image';
  const status = (job.status || '').trim() || (url ? 'FINISH' : 'processing');
  const voiceId = (job.voiceId || '').trim();
  const server = (job.server || '').trim();
  const duration =
    job.duration != null && String(job.duration).trim() !== ''
      ? String(job.duration)
      : undefined;
  return {
    id_base: job.id,
    type: feedType,
    status,
    prompt: job.prompt || undefined,
    model: job.modelId,
    ratio: job.ratio || undefined,
    resolution: job.resolution || undefined,
    mode: job.mode || undefined,
    thumbnail_url: isVisual ? url || undefined : cover || undefined,
    download_url: url || undefined,
    created_time: job.createdTime ?? undefined,
    credit_fee: typeof job.costCredits === 'number' ? job.costCredits : undefined,
    voice_id: voiceId || undefined,
    server_ai: server || undefined,
    duration,
    file_size: typeof job.fileSize === 'number' && job.fileSize > 0 ? job.fileSize : undefined,
    resolutions: url
      ? [{ type: feedType, status: 'FINISH', url, name: job.resolution || undefined }]
      : undefined,
  };
}

/**
 * User thường → chỉ job trong DB theo user_id (job-list).
 * Admin image/video → thư viện merchant Gommo (mine-media).
 * Admin music/tts → job-list của chính họ (mine-media không có audio).
 */
async function fetchPlatformMine(
  type: MineJobType,
  params: FetchMineParams,
): Promise<MinePage> {
  const { limit = 30, afterId = '' } = params;
  const q: Record<string, string> = { type, limit: String(limit) };
  if (afterId) q.afterId = afterId;

  const useJobList = !isAdminUser() || type === 'music' || type === 'tts';
  if (useJobList) {
    const parsed = await platformFeedGet<{
      success?: boolean;
      message?: string;
      data?: { items?: PlatformJobListItem[]; nextAfterId?: string };
    }>(PLATFORM_BRIDGE.jobList, q);
    const items = (parsed.data?.items ?? []).map(platformJobToFeedItem);
    return { items, nextAfterId: parsed.data?.nextAfterId ?? '' };
  }

  if (type === 'image') {
    const parsed = await platformFeedGet<MineImagesResponse>(PLATFORM_BRIDGE.mineMedia, q);
    const raw = parsed.data ?? [];
    const items = raw.map(mapImageToFeedItem);
    const last = raw.length ? raw[raw.length - 1] : undefined;
    return { items, nextAfterId: parsed.next_after_id ?? last?.id_base ?? '' };
  }

  const parsed = await platformFeedGet<MineVideosResponse>(PLATFORM_BRIDGE.mineMedia, q);
  const items = (parsed.data ?? []).map((it) => mapVideoToFeedItem(it));
  const last = items.length ? items[items.length - 1] : undefined;
  return { items, nextAfterId: parsed.next_after_id ?? last?.id_base ?? '' };
}

async function deletePlatformJob(jobId: string): Promise<void> {
  const auth = loadAuth();
  const token = auth?.platform_token?.trim();
  if (!token) throw new UpstreamMeError('Chưa đăng nhập tài khoản hệ thống', 401);

  const res = await fetch(PLATFORM_BRIDGE.jobDelete, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ platformJobId: jobId }),
  });
  if (res.status === 401 || res.status === 403) {
    clearAuth();
    if (typeof window !== 'undefined') window.location.href = '/login';
  }
  const text = await res.text();
  let parsed: { success?: boolean; message?: string };
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    throw new UpstreamMeError(text || `HTTP ${res.status}`, res.status);
  }
  if (!res.ok || parsed.success === false) {
    throw new UpstreamMeError(parsed.message || 'Xóa thất bại', res.status);
  }
}

export function feedModelLabel(item: FeedItem): string {
  return item.modelInfo?.name?.trim() || item.model?.trim() || '';
}

function isVideoMediaUrl(url: string): boolean {
  const base = url.split('?')[0].split('#')[0].toLowerCase();
  return /\.(mp4|webm|mov|m4v|m3u8|avi)(\?|$)/i.test(base) || base.includes('/video/');
}

export function isAudioMediaUrl(url: string): boolean {
  const base = url.split('?')[0].split('#')[0].toLowerCase();
  return /\.(mp3|wav|ogg|m4a|aac|flac|opus)(\?|$)/i.test(base) || base.includes('/audio/');
}

export function feedIsAudioItem(item: FeedItem): boolean {
  const t = (item.type || '').toLowerCase();
  if (t === 'music' || t === 'tts' || t.includes('audio')) return true;
  const media = feedMediaUrl(item);
  return Boolean(media && isAudioMediaUrl(media));
}

function mapVideoToFeedItem(raw: FeedItem): FeedItem {
  const ext = raw as FeedItem & {
    quality?: string | number;
    fileSize?: number;
    size?: number;
  };
  return {
    ...raw,
    type: 'video',
    thumbnail_url: raw.thumbnail_url || raw.url_preview || undefined,
    download_url: raw.download_url || raw.url || undefined,
    quality: ext.quality ?? raw.quality,
    file_size: raw.file_size || ext.fileSize || ext.size || undefined,
  };
}

export function feedThumb(item: FeedItem): string | null {
  if (feedIsAudioItem(item)) {
    // Music cover_url lưu ở thumbnail_url — không dùng file audio làm thumb.
    const cover = item.thumbnail_url?.trim() || item.url_preview?.trim();
    if (cover && !isAudioMediaUrl(cover) && !isVideoMediaUrl(cover)) return cover;
    return null;
  }

  const candidates: string[] = [];
  const push = (u?: string | null) => {
    const t = u?.trim();
    if (t) candidates.push(t);
  };
  push(item.thumbnail_url);
  push(item.url_preview);
  push(item.thumbnail_end_url);
  for (const r of item.resolutions ?? []) {
    push(r.url);
  }
  push(item.download_url);
  push(item.url);

  const poster = candidates.find((u) => !isVideoMediaUrl(u) && !isAudioMediaUrl(u));
  if (poster) return poster;
  return candidates.find((u) => !isAudioMediaUrl(u)) ?? null;
}

/** URL poster ảnh cho video (không phải file .mp4). */
export function feedPosterUrl(item: FeedItem): string | null {
  const thumb = feedThumb(item);
  if (thumb && !isVideoMediaUrl(thumb)) return thumb;
  return null;
}

export function feedMediaUrl(item: FeedItem): string | null {
  const finished = item.resolutions?.find((r) => r.status === 'FINISH' && r.url);
  if (finished?.url) return finished.url;
  if (item.download_url?.trim()) return item.download_url;
  const anyRes = item.resolutions?.find((r) => r.url);
  return anyRes?.url || null;
}

export function feedSourceCount(item: FeedItem): number {
  return (item.images?.length || 0) + (item.objects?.length || 0);
}

/** Số lượng hiển thị trên card (ref assets hoặc batch resolutions). */
export function feedDisplayQty(item: FeedItem): number {
  const refs = feedSourceCount(item);
  const resCount = item.resolutions?.filter((r) => r.url || r.status === 'FINISH').length ?? 0;
  return Math.max(1, refs > 1 ? refs : resCount > 1 ? resCount : refs || 1);
}

export function feedIsFailed(item: FeedItem): boolean {
  const media = feedMediaUrl(item);
  const s = (item.status || '').toUpperCase();
  if (media && (s.includes('SUCCESS') || s === 'FINISH' || s === 'FINISHED' || s === '')) {
    return false;
  }
  if (!s) return false;
  if (s.includes('SUCCESS') || s === 'FINISH' || s === 'FINISHED' || s.includes('PROCESSING')) {
    return false;
  }
  return (
    s.includes('FAIL')
    || s.includes('ERROR')
    || s.includes('REJECT')
    || s.includes('CANCEL')
    || s.includes('BLOCK')
    || s.includes('NSFW')
    || s.includes('DENIED')
  );
}

/** Job đủ dữ liệu để hiển thị trên grid (kể cả failed). */
export function feedIsDisplayable(item: FeedItem): boolean {
  if (feedThumb(item) || feedMediaUrl(item)) return true;
  if (feedIsFailed(item)) return true;
  const s = (item.status || '').toUpperCase();
  return s.includes('PROCESS') || s.includes('PENDING') || s.includes('QUEUE');
}

export function formatFeedTime(value: string | number | undefined): string {
  if (value == null) return '';
  const ts = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(ts) || ts <= 0) return '';
  try {
    return new Date(ts * 1000).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

/** Xóa ảnh/video — user thường xóa platform_jobs; admin xóa trên Gommo. */
export async function deleteFeedPost(idBase: string): Promise<void> {
  const id = idBase.trim();
  if (!id) throw new UpstreamMeError('Thiếu id_base', 400);

  if (usesPlatformJobs() && !isAdminUser()) {
    await deletePlatformJob(id);
    return;
  }

  const fields = { id_base: id, ...gommoDeviceFields() };
  const parsed = await feedRequest<{ success?: boolean; message?: string }>(
    `${GOMMO_AUTH_PATH}/ai/post-delete`,
    fields,
  );
  if (parsed.success === false) {
    throw new UpstreamMeError(parsed.message || 'Xóa thất bại');
  }
}
