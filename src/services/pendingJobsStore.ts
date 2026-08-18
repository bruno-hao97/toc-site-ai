import type { ComposerPendingJob } from '../components/ComposerHistory';
import type { JobType } from './api';
import { authUserKey } from './authStore';
import type { FeedItem } from './feedApi';
import { feedItemPrompt, isFeedItemProcessing } from '../utils/feedProcessing';
import { matchesLibraryStatusFilter } from '../utils/feedLibraryStatus';
import { libraryTabForJobType } from '../utils/libraryTabForJobType';

export interface SharedPendingJob extends ComposerPendingJob {
  jobType: JobType;
  createdAt: number;
}

const EVENT = 'pending-jobs:updated';
const STORAGE_PREFIX = 'toc.pending.jobs';
const MAX_AGE_MS = 120_000;

function storageKey(): string {
  return `${STORAGE_PREFIX}:${authUserKey()}`;
}

let cache: SharedPendingJob[] | null = null;

function isValidJob(value: unknown): value is SharedPendingJob {
  if (!value || typeof value !== 'object') return false;
  const j = value as SharedPendingJob;
  return (
    typeof j.id === 'string' &&
    typeof j.prompt === 'string' &&
    typeof j.jobType === 'string' &&
    (j.status === 'processing' || j.status === 'failed') &&
    typeof j.createdAt === 'number'
  );
}

function loadRaw(): SharedPendingJob[] {
  if (cache) return cache;
  try {
    const raw = sessionStorage.getItem(storageKey());
    if (!raw) {
      cache = [];
      return cache;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      cache = [];
      return cache;
    }
    const now = Date.now();
    cache = parsed
      .filter(isValidJob)
      .filter((j) => j.status === 'processing' && now - j.createdAt < MAX_AGE_MS);
    return cache;
  } catch {
    cache = [];
    return cache;
  }
}

function dispatchUpdated(): void {
  document.dispatchEvent(new CustomEvent(EVENT));
}

function save(jobs: SharedPendingJob[]): void {
  cache = jobs;
  try {
    if (jobs.length) sessionStorage.setItem(storageKey(), JSON.stringify(jobs));
    else sessionStorage.removeItem(storageKey());
  } catch {
    /* quota / private mode */
  }
  dispatchUpdated();
}

export function jobTypesMatch(stored: JobType, target: JobType): boolean {
  return libraryTabForJobType(stored) === libraryTabForJobType(target);
}

export function getSharedPendingJobs(jobType?: JobType): SharedPendingJob[] {
  const all = loadRaw();
  if (!jobType) return [...all];
  return all.filter((j) => jobTypesMatch(j.jobType, jobType));
}

export function getSharedPendingJobsForTypes(jobTypes: JobType[]): SharedPendingJob[] {
  if (!jobTypes.length) return [];
  const all = loadRaw();
  return all.filter((j) => jobTypes.some((t) => jobTypesMatch(j.jobType, t)));
}

export function toComposerPendingJobs(jobs: SharedPendingJob[]): ComposerPendingJob[] {
  return jobs.map(({ id, prompt, status, progress }) => ({ id, prompt, status, progress }));
}

export function addSharedPendingJobs(jobType: JobType, jobs: ComposerPendingJob[]): void {
  if (!jobs.length) return;
  const existing = loadRaw();
  const ids = new Set(existing.map((j) => j.id));
  const now = Date.now();
  const fresh: SharedPendingJob[] = jobs
    .filter((j) => !ids.has(j.id))
    .map((j) => ({ ...j, jobType, createdAt: now }));
  if (!fresh.length) return;
  save([...fresh, ...existing.filter((j) => j.status === 'processing')]);
}

export function updateSharedPendingJob(id: string, patch: Partial<ComposerPendingJob>): void {
  save(
    loadRaw().map((j) => (j.id === id ? { ...j, ...patch } : j)),
  );
}

export function bumpSharedPendingProgress(id: string, progress: number): void {
  save(
    loadRaw().map((j) =>
      j.id === id
        ? { ...j, progress: Math.min(99, Math.max(j.progress ?? 5, progress)) }
        : j,
    ),
  );
}

export function removeSharedPendingJob(id: string): void {
  save(loadRaw().filter((j) => j.id !== id));
}

export function subscribeSharedPendingJobs(cb: () => void): () => void {
  const handler = () => cb();
  document.addEventListener(EVENT, handler);
  return () => document.removeEventListener(EVENT, handler);
}

/** Gỡ 1 pending (FIFO) khi feed có 1 kết quả success khớp prompt. */
export function pruneSharedPendingAgainstFeed(items: FeedItem[], jobType: JobType): void {
  const pending = loadRaw().filter(
    (j) => jobTypesMatch(j.jobType, jobType) && j.status === 'processing',
  );
  if (!pending.length) return;

  const successes = items.filter(
    (it) =>
      !isFeedItemProcessing(it) &&
      matchesLibraryStatusFilter(it, 'success') &&
      feedItemPrompt(it).trim(),
  );
  if (!successes.length) return;

  let remaining = [...pending];
  const removeIds = new Set<string>();

  for (const item of successes) {
    const prompt = feedItemPrompt(item).trim();
    const idx = remaining.findIndex((p) => p.prompt.trim() === prompt);
    if (idx < 0) continue;
    removeIds.add(remaining[idx].id);
    remaining = remaining.filter((_, i) => i !== idx);
  }

  if (!removeIds.size) return;
  save(loadRaw().filter((j) => !removeIds.has(j.id)));
}

export function expireStaleSharedPendingJobs(): void {
  const now = Date.now();
  const next = loadRaw().filter((j) => now - j.createdAt < MAX_AGE_MS);
  if (next.length !== loadRaw().length) save(next);
}
