import { isLoggedIn, loadAuth } from './authStore';
import {
  analyzeModel,
  buildJobPayload,
  modelSlug,
  parseModelsList,
  type JobSelections,
  type ModelSchema,
} from './modelSchema';
import { getJobClient } from './platformJobClient';
import { createJobAndPoll } from './polling';
import type { GommoModel, JobType } from './api';

/** Có thể tạo job khi đã đăng nhập (platform hoặc Gommo). */
export function canQuickCreate(): boolean {
  return isLoggedIn();
}

export async function loadQuickModels(type: JobType): Promise<GommoModel[]> {
  if (!loadAuth()) return [];
  return parseModelsList(await getJobClient().fetchModels(type));
}

export function buildQuickSchema(model: GommoModel, type: JobType): ModelSchema {
  return analyzeModel(model, type);
}

export async function uploadQuickImage(file: File): Promise<string | null> {
  if (!loadAuth()) return null;
  const { url } = await getJobClient().uploadImage(file);
  return url;
}

export async function uploadQuickVideo(file: File): Promise<string | null> {
  if (!loadAuth()) return null;
  const { url } = await getJobClient().uploadVideo(file);
  return url;
}

/** Tải ảnh hoặc video tùy MIME — dùng cho quick bar khi mode video. */
export async function uploadQuickMedia(file: File): Promise<string | null> {
  if (!loadAuth()) return null;
  const client = getJobClient();
  const { url } = file.type.startsWith('video/')
    ? await client.uploadVideo(file)
    : await client.uploadImage(file);
  return url;
}

export interface QuickGenerateArgs {
  type: JobType;
  model: GommoModel;
  selections: JobSelections;
  onProgress?: (msg: string) => void;
  signal?: AbortSignal;
}

export async function quickGenerate({
  type,
  model,
  selections,
  onProgress,
  signal,
}: QuickGenerateArgs): Promise<string> {
  const auth = loadAuth();
  if (!auth) throw new Error('Chưa đăng nhập — không thể tạo job.');

  const client = getJobClient();
  const slug = modelSlug(model);
  const { payload } = buildJobPayload(model, type, selections, {
    domain: auth.domain || client.domain,
    projectId: client.projectId,
  });

  const { pollResult, resultUrl } = await createJobAndPoll(
    client,
    type,
    slug,
    payload,
    (p) => {
      if ('phase' in p && p.phase === 'creating') {
        onProgress?.('Đang tạo job…');
        return;
      }
      const prog = p as { status?: string; phase?: string };
      onProgress?.(`Đang xử lý… ${prog.status || prog.phase || ''}`.trim());
    },
    signal,
  );
  if (resultUrl) return resultUrl;
  throw new Error(pollResult?.error || 'Job thất bại');
}
