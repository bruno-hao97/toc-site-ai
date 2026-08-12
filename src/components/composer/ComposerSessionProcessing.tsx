import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JobType } from '../../services/api';
import { fetchMyImages, fetchMyVideos, type FeedItem } from '../../services/feedApi';
import { feedItemPrompt, isFeedItemProcessing } from '../../utils/feedProcessing';
import type { ComposerPendingJob } from '../ComposerHistory';

type Kind = 'image' | 'video' | 'unsupported';

function jobKind(jobType: JobType): Kind {
  if (jobType === 'image') return 'image';
  if (jobType === 'video' || jobType === 'avatar-lipsync') return 'video';
  return 'unsupported';
}

function toPendingJob(item: FeedItem): ComposerPendingJob {
  const id = item.id_base || `upstream-${item.created_time ?? item.platform_job_id ?? 'x'}`;
  return {
    id,
    prompt: feedItemPrompt(item),
    status: 'processing',
    progress: 12,
  };
}

export default function ComposerSessionProcessing({
  jobType,
  refreshKey = 0,
  pendingJobs = [],
  onCountChange,
  onLoadingChange,
  onUpstreamPendingChange,
}: {
  jobType: JobType;
  refreshKey?: number;
  pendingJobs?: ComposerPendingJob[];
  onCountChange?: (count: number) => void;
  onLoadingChange?: (loading: boolean) => void;
  onUpstreamPendingChange?: (jobs: ComposerPendingJob[]) => void;
}) {
  const kind = jobKind(jobType);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [discoveryActive, setDiscoveryActive] = useState(true);
  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    if (kind === 'unsupported') return;
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const fetcher = kind === 'image' ? fetchMyImages : fetchMyVideos;
      const page = await fetcher({ limit: 30, afterId: '' });
      setItems(page.items);
    } catch {
      /* giữ danh sách cũ */
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    setItems([]);
    setDiscoveryActive(true);
    void load();
  }, [load]);

  useEffect(() => {
    if (!discoveryActive) return;
    const id = window.setTimeout(() => setDiscoveryActive(false), 120_000);
    return () => window.clearTimeout(id);
  }, [discoveryActive, kind]);

  useEffect(() => {
    if (!refreshKey) return;
    void load();
  }, [refreshKey, load]);

  const localPendingCount = useMemo(
    () => pendingJobs.filter((p) => p.status === 'processing').length,
    [pendingJobs],
  );

  const hasProcessingUpstream = useMemo(
    () => items.some(isFeedItemProcessing),
    [items],
  );

  const pendingPrompts = useMemo(() => {
    const set = new Set<string>();
    pendingJobs
      .filter((p) => p.status === 'processing')
      .forEach((p) => {
        const text = p.prompt.trim();
        if (text) set.add(text);
      });
    return set;
  }, [pendingJobs]);

  const upstreamPending = useMemo(() => {
    return items
      .filter(isFeedItemProcessing)
      .filter((item) => {
        const prompt = feedItemPrompt(item);
        return !prompt || !pendingPrompts.has(prompt);
      })
      .map(toPendingJob);
  }, [items, pendingPrompts]);

  useEffect(() => {
    onCountChange?.(upstreamPending.length);
  }, [upstreamPending.length, onCountChange]);

  useEffect(() => {
    onUpstreamPendingChange?.(upstreamPending);
  }, [upstreamPending, onUpstreamPendingChange]);

  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  useEffect(() => {
    if (kind === 'unsupported') return;
    const shouldPoll =
      localPendingCount > 0 || hasProcessingUpstream || discoveryActive;
    if (!shouldPoll) return;
    const id = window.setInterval(() => {
      void load();
    }, 4000);
    return () => window.clearInterval(id);
  }, [kind, load, localPendingCount, hasProcessingUpstream, discoveryActive]);

  return null;
}
