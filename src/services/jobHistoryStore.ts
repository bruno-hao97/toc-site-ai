import type { JobType } from './api';
import { authUserKey } from './authStore';

export interface LocalJob {
  id: string;
  type: JobType;
  model_id: string;
  status: 'success' | 'failed' | 'processing';
  result_url?: string | null;
  error?: string;
  created_at: string;
}

const LEGACY_KEY = 'gommo_job_history';
const MAX = 50;

function storageKey(): string {
  return `${LEGACY_KEY}:${authUserKey()}`;
}

export function listLocalJobs(): LocalJob[] {
  try {
    const key = storageKey();
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as LocalJob[];

    const legacyRaw = localStorage.getItem(LEGACY_KEY);
    if (!legacyRaw) return [];
    const legacy = JSON.parse(legacyRaw) as LocalJob[];
    if (Array.isArray(legacy) && legacy.length) {
      localStorage.setItem(key, JSON.stringify(legacy));
    }
    localStorage.removeItem(LEGACY_KEY);
    return Array.isArray(legacy) ? legacy : [];
  } catch {
    return [];
  }
}

export function addLocalJob(job: LocalJob): void {
  const list = [job, ...listLocalJobs()].slice(0, MAX);
  localStorage.setItem(storageKey(), JSON.stringify(list));
}

export function updateLocalJob(id: string, patch: Partial<LocalJob>): void {
  const list = listLocalJobs().map((j) => (j.id === id ? { ...j, ...patch } : j));
  localStorage.setItem(storageKey(), JSON.stringify(list));
}
