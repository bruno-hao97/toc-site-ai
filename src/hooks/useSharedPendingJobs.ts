import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ComposerPendingJob } from '../components/ComposerHistory';
import type { JobType } from '../services/api';
import type { FeedItem } from '../services/feedApi';
import {
  addSharedPendingJobs,
  getSharedPendingJobs,
  getSharedPendingJobsForTypes,
  pruneSharedPendingAgainstFeed,
  removeSharedPendingJob,
  subscribeSharedPendingJobs,
  toComposerPendingJobs,
  updateSharedPendingJob,
} from '../services/pendingJobsStore';

type PendingScope = JobType | JobType[];

function resolveTypes(scope: PendingScope): JobType[] {
  return Array.isArray(scope) ? scope : [scope];
}

function readJobs(scope: PendingScope): ComposerPendingJob[] {
  const types = resolveTypes(scope);
  if (types.length === 1) return toComposerPendingJobs(getSharedPendingJobs(types[0]));
  return toComposerPendingJobs(getSharedPendingJobsForTypes(types));
}

export function useSharedPendingJobs(scope: PendingScope) {
  const types = resolveTypes(scope);
  const typesKey = types.join(',');

  const [jobs, setJobs] = useState<ComposerPendingJob[]>(() => readJobs(scope));

  useEffect(() => {
    setJobs(readJobs(scope));
    return subscribeSharedPendingJobs(() => setJobs(readJobs(scope)));
  }, [typesKey, scope]);

  const add = useCallback(
    (newJobs: ComposerPendingJob[]) => {
      const jobType = types[0];
      if (!jobType || !newJobs.length) return;
      addSharedPendingJobs(jobType, newJobs);
    },
    [types],
  );

  const addForType = useCallback((jobType: JobType, newJobs: ComposerPendingJob[]) => {
    addSharedPendingJobs(jobType, newJobs);
  }, []);

  const remove = useCallback((id: string) => {
    removeSharedPendingJob(id);
  }, []);

  const update = useCallback((id: string, patch: Partial<ComposerPendingJob>) => {
    updateSharedPendingJob(id, patch);
  }, []);

  const pruneAgainstFeed = useCallback(
    (items: FeedItem[]) => {
      for (const jobType of types) {
        pruneSharedPendingAgainstFeed(items, jobType);
      }
    },
    [types],
  );

  const activeCount = useMemo(
    () => jobs.filter((j) => j.status === 'processing').length,
    [jobs],
  );

  return { jobs, activeCount, add, addForType, remove, update, pruneAgainstFeed };
}
