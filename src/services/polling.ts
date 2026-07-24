import { GommoClient, type JobType, type PollMedia } from './api';
import type { PlatformJobClient } from './platformJobClient';
import {
  classifyGatewayStatus,
  extractPollSnapshot,
  type StatusPhase,
} from './mediaGenerationStatus';
import { formatPollCancelledMessage, formatPollTimeoutMessage } from './pollProgressCopy';
import { pollMediaForJobType } from './modelSchema';
import { formatAcceptedPendingMessage, isInfraJobError } from './jobInfraErrors';

export interface PollProgress {
  attempt: number;
  phase: StatusPhase;
  status: string;
  resultUrl: string | null;
  coverUrl?: string | null;
  idBase?: string;
  envelope: unknown;
}

export interface PollResult {
  success: boolean;
  timeout?: boolean;
  /** Lỗi kỹ thuật (proxy/DB) — job có thể vẫn chạy trên VMedia. */
  infraError?: boolean;
  /** Đã có job id phía provider nhưng chưa có URL kết quả. */
  acceptedPending?: boolean;
  error?: string;
  status?: string;
  resultUrl?: string | null;
  coverUrl?: string | null;
  idBase?: string;
}

const POLL_INTERVAL_MS = 3500;
const POLL_MAX_ATTEMPTS = 80;

export async function startPolling(
  client: GommoClient | PlatformJobClient,
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
  let lastInfraError = '';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) {
      return { success: false, error: formatPollCancelledMessage(), idBase: jobId };
    }

    try {
      const envelope = await client.pollOnce(jobId, media);
      const snap = extractPollSnapshot(envelope);
      const phase = classifyGatewayStatus(snap.status, snap.resultUrl);

      onProgress?.({
        attempt,
        phase,
        status: snap.status,
        resultUrl: snap.resultUrl,
        coverUrl: snap.coverUrl,
        idBase: snap.idBase || jobId,
        envelope,
      });

      if (phase === 'success') {
        return { success: true, ...snap, idBase: snap.idBase || jobId };
      }
      if (phase === 'failed') {
        return {
          success: false,
          error: snap.status || 'failed',
          ...snap,
          idBase: snap.idBase || jobId,
        };
      }
    } catch (err) {
      // Lỗi bridge/proxy: tiếp tục poll — job có thể đã chạy trên VMedia.
      if (isInfraJobError(err) && attempt < maxAttempts) {
        lastInfraError = err instanceof Error ? err.message : String(err);
        onProgress?.({
          attempt,
          phase: 'running',
          status: 'PROCESSING',
          resultUrl: null,
          idBase: jobId,
          envelope: null,
        });
      } else if (isInfraJobError(err)) {
        lastInfraError = err instanceof Error ? err.message : String(err);
        break;
      } else {
        throw err;
      }
    }

    await sleep(intervalMs);
  }

  if (lastInfraError) {
    return {
      success: false,
      timeout: true,
      infraError: true,
      acceptedPending: true,
      idBase: jobId,
      error: formatAcceptedPendingMessage(jobId),
    };
  }

  return {
    success: false,
    timeout: true,
    acceptedPending: true,
    idBase: jobId,
    error: formatPollTimeoutMessage(),
  };
}

export async function createJobAndPoll(
  client: GommoClient | PlatformJobClient,
  type: JobType,
  modelId: string,
  fields: Record<string, unknown>,
  onProgress?: (p: PollProgress | { phase: 'creating' }) => void,
  signal?: AbortSignal,
): Promise<{
  createEnvelope: unknown;
  pollResult?: PollResult;
  resultUrl?: string | null;
  coverUrl?: string | null;
  /** Có id phía VMedia — coi như đã nhận job. */
  acceptedOnProvider: boolean;
  providerJobId?: string;
}> {
  onProgress?.({ phase: 'creating' });
  const createEnvelope = await client.createJob(type, modelId, fields);
  const snap = extractPollSnapshot(createEnvelope);
  const providerJobId = snap.idBase?.trim() || undefined;
  const acceptedOnProvider = Boolean(providerJobId);

  if (snap.resultUrl && classifyGatewayStatus(snap.status, snap.resultUrl) === 'success') {
    return {
      createEnvelope,
      resultUrl: snap.resultUrl,
      coverUrl: snap.coverUrl,
      acceptedOnProvider: true,
      providerJobId,
    };
  }

  const pollMedia = pollMediaForJobType(type);
  if (!pollMedia) {
    return {
      createEnvelope,
      resultUrl: snap.resultUrl,
      coverUrl: snap.coverUrl,
      acceptedOnProvider,
      providerJobId,
    };
  }

  if (!providerJobId) {
    return {
      createEnvelope,
      pollResult: { success: false, error: 'Không có id_base để poll' },
      coverUrl: snap.coverUrl,
      acceptedOnProvider: false,
    };
  }

  const pollResult = await startPolling(client, providerJobId, pollMedia, {
    onProgress,
    signal,
  });

  return {
    createEnvelope,
    pollResult,
    resultUrl: pollResult.resultUrl ?? snap.resultUrl,
    coverUrl: pollResult.coverUrl ?? snap.coverUrl,
    acceptedOnProvider: true,
    providerJobId,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
