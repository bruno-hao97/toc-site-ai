import type { FeedItem } from '../services/feedApi';
import {
  classifyGatewayStatus,
  classifySharedImageStatus,
  classifySharedVideoStatus,
  isValidResultUrl,
} from '../services/mediaGenerationStatus';

const SUCCESS_RE = /finish|success|done|complete/i;
const FAIL_RE = /error|fail|reject|cancel/i;
const RUNNING_STATUS_RE = /process|pending|queue|active/i;

function blockUrls(item: FeedItem): string[] {
  const out: string[] = [];
  item.resolutions?.forEach((r) => r.url && out.push(r.url));
  item.images?.forEach((i) => i.url && out.push(i.url));
  item.objects?.forEach((i) => i.url && out.push(i.url));
  if (item.download_url) out.push(item.download_url);
  else if (item.thumbnail_url) out.push(item.thumbnail_url);
  return [...new Set(out)];
}

function blockCounts(item: FeedItem): { ok: number; fail: number } {
  if (item.resolutions && item.resolutions.length) {
    const ok = item.resolutions.filter((r) => Boolean(r.url?.trim())).length;
    return { ok, fail: item.resolutions.length - ok };
  }
  const hasMedia = blockUrls(item).length > 0;
  const ok = hasMedia ? 1 : 0;
  const fail = FAIL_RE.test(item.status || '') ? 1 : 0;
  return { ok, fail };
}

function classifyFeedTypeStatus(item: FeedItem): 'running' | 'success' | 'failed' | 'unknown' {
  const kind = (item.type || '').toLowerCase();
  const urls = blockUrls(item);
  const primaryUrl = urls[0] || item.download_url || item.thumbnail_url || null;

  if (kind === 'image') {
    const phase = classifySharedImageStatus(item.status);
    if (phase === 'running') return 'running';
    if (phase === 'success' && isValidResultUrl(primaryUrl)) return 'success';
    if (phase === 'success' && !isValidResultUrl(primaryUrl)) return 'unknown';
    if (phase === 'failed') return 'failed';
  }

  if (kind === 'video' || kind === 'avatar-lipsync') {
    const phase = classifySharedVideoStatus(item.status);
    if (phase === 'running') return 'running';
    if (phase === 'success' && isValidResultUrl(primaryUrl)) return 'success';
    if (phase === 'success' && !isValidResultUrl(primaryUrl)) return 'unknown';
    if (phase === 'failed') return 'failed';
  }

  return 'unknown';
}

function hasRunningStatusText(status: unknown): boolean {
  const s = String(status ?? '').toUpperCase();
  if (!s) return false;
  if (FAIL_RE.test(s)) return false;
  if (SUCCESS_RE.test(s) && !RUNNING_STATUS_RE.test(s)) return false;
  return RUNNING_STATUS_RE.test(s);
}

export function isFeedItemProcessing(item: FeedItem): boolean {
  if (FAIL_RE.test(item.status || '')) return false;

  const urls = blockUrls(item);
  if (SUCCESS_RE.test(item.status || '') && urls.length > 0) return false;

  const typed = classifyFeedTypeStatus(item);
  if (typed === 'running') return true;
  if (typed === 'success') return false;

  if (classifyGatewayStatus(item.status, urls[0] || null) === 'running') return true;
  if (item.resolutions?.some((r) => classifyGatewayStatus(r.status, r.url) === 'running')) {
    return true;
  }

  if (urls.length === 0 && hasRunningStatusText(item.status)) return true;

  const { ok } = blockCounts(item);
  return ok === 0 && urls.length === 0 && !FAIL_RE.test(item.status || '');
}

export function feedItemPrompt(item: FeedItem): string {
  return (item.prompt || item.title || '').trim();
}
