import type { ComposerPendingJob } from '../components/ComposerHistory';
import type { JobType } from '../services/api';
import {
  addSharedPendingJobs,
  getSharedPendingJobsForTypes,
  toComposerPendingJobs,
} from '../services/pendingJobsStore';
import { libraryTabForJobType } from './libraryTabForJobType';
import type { MineFilter } from '../components/HomeMyContent';

export interface LibraryNavigateState {
  pendingJobs?: ComposerPendingJob[];
  pendingJobType?: JobType;
}

export function buildLibraryPendingJobs(prompt: string, count = 1): ComposerPendingJob[] {
  const text = prompt.trim();
  return Array.from({ length: Math.max(1, count) }, () => ({
    id: crypto.randomUUID(),
    prompt: text,
    status: 'processing' as const,
    progress: 12,
  }));
}

export function libraryNavigateState(
  type: JobType,
  pendingJobs: ComposerPendingJob[],
): LibraryNavigateState {
  return pendingJobs.length ? { pendingJobs, pendingJobType: type } : {};
}

export function readLibraryNavigateState(state: unknown): LibraryNavigateState {
  if (!state || typeof state !== 'object') return {};
  const raw = state as LibraryNavigateState;
  const jobs = Array.isArray(raw.pendingJobs)
    ? raw.pendingJobs.filter(
        (j): j is ComposerPendingJob =>
          Boolean(j) &&
          typeof j.id === 'string' &&
          typeof j.prompt === 'string' &&
          (j.status === 'processing' || j.status === 'failed'),
      )
    : [];
  const pendingJobType =
    typeof raw.pendingJobType === 'string' ? (raw.pendingJobType as JobType) : undefined;
  return { pendingJobs: jobs, pendingJobType };
}

export function stashLibraryPending(state: LibraryNavigateState): void {
  if (!state.pendingJobs?.length || !state.pendingJobType) return;
  addSharedPendingJobs(state.pendingJobType, state.pendingJobs);
}

/** @deprecated Dùng pendingJobsStore — giữ để tương thích đọc navigate state. */
export function takeLibraryPending(): LibraryNavigateState {
  return {};
}

export function pendingMatchesFilter(
  pendingJobType: JobType | undefined,
  filter: MineFilter,
): boolean {
  if (!pendingJobType) return false;
  const tab = libraryTabForJobType(pendingJobType);
  if (filter === 'all') return tab === 'image' || tab === 'video';
  return tab === filter;
}

export function readSharedPendingForFilter(filter: MineFilter): ComposerPendingJob[] {
  if (filter === 'image') return toComposerPendingJobs(getSharedPendingJobsForTypes(['image']));
  if (filter === 'video') return toComposerPendingJobs(getSharedPendingJobsForTypes(['video']));
  if (filter === 'all') return toComposerPendingJobs(getSharedPendingJobsForTypes(['image', 'video']));
  return [];
}
