import type { GommoModel, JobType } from './api';
import { getGommoClient, loadAuth } from './authStore';
import { createJobAndPoll, type PollProgress } from './polling';
import {
  analyzeModel,
  buildJobPayload,
  defaultSelections,
  isModelAvailable,
  modelSlug,
  parseModelsList,
  type JobSelections,
} from './modelSchema';

const modelsCache = new Map<JobType, GommoModel[]>();

export async function fetchModelsForType(type: JobType): Promise<GommoModel[]> {
  const cached = modelsCache.get(type);
  if (cached) return cached;

  const auth = loadAuth();
  if (!auth?.access_token) return [];

  const env = await getGommoClient().fetchModels(type);
  const models = parseModelsList(env);
  modelsCache.set(type, models);
  return models;
}

export function pickDefaultModel(models: GommoModel[]): GommoModel | null {
  return models.find((m) => isModelAvailable(m)) ?? models[0] ?? null;
}

export interface RunNodeInput {
  type: JobType;
  modelId: string;
  selections: JobSelections;
  onStatus?: (s: string) => void;
  signal?: AbortSignal;
}

export async function runNodeJob(input: RunNodeInput): Promise<string> {
  const { type, modelId, selections, onStatus, signal } = input;

  const models = await fetchModelsForType(type);
  const model = models.find((m) => modelSlug(m) === modelId);
  if (!model) throw new Error(`Không tìm thấy model "${modelId}" cho ${type}`);

  const auth = loadAuth();
  if (!auth?.access_token) throw new Error('Chưa đăng nhập');

  const schema = analyzeModel(model, type);
  const merged: JobSelections = { ...defaultSelections(schema), ...selections };
  const { payload } = buildJobPayload(model, type, merged, {
    domain: auth.domain,
    projectId: auth.projectId,
  });

  onStatus?.('Đang tạo job…');
  const { pollResult, resultUrl } = await createJobAndPoll(
    getGommoClient(),
    type,
    modelId,
    payload,
    (p) => {
      if ('phase' in p && p.phase === 'creating') {
        onStatus?.('Đang gửi request…');
        return;
      }
      const prog = p as PollProgress;
      onStatus?.(`Poll #${prog.attempt}: ${prog.status || prog.phase}`);
    },
    signal,
  );
  if (resultUrl) return resultUrl;
  throw new Error(pollResult?.error || 'Job thất bại');
}
