import { getGommoClient, loadAuth } from './authStore';
import {
  analyzeModel,
  buildJobPayload,
  modelSlug,
  parseModelsList,
  type JobSelections,
  type ModelSchema,
} from './modelSchema';
import { createJobAndPoll } from './polling';
import type { GommoModel, JobType } from './api';

/** Có thể tạo job khi đã đăng nhập Gommo. */
export function canQuickCreate(): boolean {
  return Boolean(loadAuth()?.access_token?.trim());
}

export async function loadQuickModels(type: JobType): Promise<GommoModel[]> {
  if (!loadAuth()) return [];
  return parseModelsList(await getGommoClient().fetchModels(type));
}

export function buildQuickSchema(model: GommoModel, type: JobType): ModelSchema {
  return analyzeModel(model, type);
}

export async function uploadQuickImage(file: File): Promise<string | null> {
  if (!loadAuth()) return null;
  const { url } = await getGommoClient().uploadImage(file);
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

  const client = getGommoClient();
  const slug = modelSlug(model);
  const { payload } = buildJobPayload(model, type, selections, {
    domain: auth.domain,
    projectId: auth.projectId,
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
