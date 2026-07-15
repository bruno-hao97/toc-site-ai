import { GommoClient, type JobType, type PollMedia } from './api';
import {
  classifyGatewayStatus,
  extractPollSnapshot,
  type StatusPhase,
} from './mediaGenerationStatus';
import { pollMediaForJobType } from './modelSchema';

export interface PollProgress {
  attempt: number;
  phase: StatusPhase;
  status: string;
  resultUrl: string | null;
  idBase?: string;
  envelope: unknown;
}

export interface PollResult {
  success: boolean;
  timeout?: boolean;
  error?: string;
  status?: string;
  resultUrl?: string | null;
  idBase?: string;
}

const POLL_INTERVAL_MS = 3500;
const POLL_MAX_ATTEMPTS = 80;

export async function startPolling(
  client: GommoClient,
  jobId: string,
  media: PollMedia,
  {
    intervalMs = POLL_INTERVAL_MS,
    maxAttempts = POLL_MAX_ATTEMPTS,
    onProgress,
    signal,
  }: {
    intervalMs?: number;
    maxAttempts?: number;
    onProgress?: (p: PollProgress) => void;
    signal?: AbortSignal;
  } = {},
): Promise<PollResult> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) {
      return { success: false, error: 'Poll đã bị hủy' };
    }

    const envelope = await client.pollOnce(jobId, media);
    const snap = extractPollSnapshot(envelope);
    const phase = classifyGatewayStatus(snap.status, snap.resultUrl);

    onProgress?.({
      attempt,
      phase,
      status: snap.status,
      resultUrl: snap.resultUrl,
      idBase: snap.idBase,
      envelope,
    });

    if (phase === 'success') {
      return { success: true, ...snap };
    }
    if (phase === 'failed') {
      return { success: false, error: snap.status || 'failed', ...snap };
    }

    await sleep(intervalMs);
  }

  return { success: false, timeout: true, error: 'Hết thời gian poll (~5 phút)' };
}

export async function createJobAndPoll(
  client: GommoClient,
  type: JobType,
  modelId: string,
  fields: Record<string, unknown>,
  onProgress?: (p: PollProgress | { phase: 'creating' }) => void,
  signal?: AbortSignal,
): Promise<{
  createEnvelope: unknown;
  pollResult?: PollResult;
  resultUrl?: string | null;
}> {
  onProgress?.({ phase: 'creating' });
  const createEnvelope = await client.createJob(type, modelId, fields);
  const snap = extractPollSnapshot(createEnvelope);

  if (snap.resultUrl && classifyGatewayStatus(snap.status, snap.resultUrl) === 'success') {
    return { createEnvelope, resultUrl: snap.resultUrl };
  }

  const pollMedia = pollMediaForJobType(type);
  if (!pollMedia) {
    return { createEnvelope, resultUrl: snap.resultUrl };
  }

  const jobId = snap.idBase;
  if (!jobId) {
    return {
      createEnvelope,
      pollResult: { success: false, error: 'Không có id_base để poll' },
    };
  }

  const pollResult = await startPolling(client, jobId, pollMedia, {
    onProgress,
    signal,
  });

  return {
    createEnvelope,
    pollResult,
    resultUrl: pollResult.resultUrl ?? snap.resultUrl,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
