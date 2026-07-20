import type { GommoModel, JobType } from './api';
import { isLoggedIn, loadAuth } from './authStore';
import { getJobClient } from './platformJobClient';
import { createJobAndPoll, type PollProgress } from './polling';
import {
  analyzeModel,
  buildJobPayload,
  isModelAvailable,
  mergeSelectionsForSchema,
  modelSlug,
  parseModelsList,
  type JobSelections,
} from './modelSchema';

const modelsCache = new Map<JobType, GommoModel[]>();

export async function fetchModelsForType(type: JobType): Promise<GommoModel[]> {
  const cached = modelsCache.get(type);
  if (cached) return cached;

  if (!isLoggedIn()) return [];

  const env = await getJobClient().fetchModels(type);
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
  if (!auth || !isLoggedIn()) throw new Error('Chưa đăng nhập');

  const client = getJobClient();
  const schema = analyzeModel(model, type);
  const merged = mergeSelectionsForSchema(selections, schema);
  const { payload } = buildJobPayload(model, type, merged, {
    domain: auth.domain || client.domain,
    projectId: client.projectId,
  });

  onStatus?.('Đang tạo job…');
  const { pollResult, resultUrl } = await createJobAndPoll(
    client,
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
