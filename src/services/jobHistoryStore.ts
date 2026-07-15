import type { JobType } from './api';

export interface LocalJob {
  id: string;
  type: JobType;
  model_id: string;
  status: 'success' | 'failed' | 'processing';
  result_url?: string | null;
  error?: string;
  created_at: string;
}

const KEY = 'gommo_job_history';
const MAX = 50;

export function listLocalJobs(): LocalJob[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LocalJob[];
  } catch {
    return [];
  }
}

export function addLocalJob(job: LocalJob): void {
  const list = [job, ...listLocalJobs()].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function updateLocalJob(id: string, patch: Partial<LocalJob>): void {
  const list = listLocalJobs().map((j) => (j.id === id ? { ...j, ...patch } : j));
  localStorage.setItem(KEY, JSON.stringify(list));
}
