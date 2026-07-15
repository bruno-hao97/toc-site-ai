import type { Node } from '@xyflow/react';
import type { FeedItem } from './feedApi';

/** Map kết quả node Tạo ảnh/Video AI → FeedItem để mở ComposerLibraryPreviewModal. */
export function workflowNodeToFeedItem(node: Node): FeedItem | null {
  const data = (node.data ?? {}) as Record<string, unknown>;
  const url = String(data.resultUrl || '').trim();
  if (!url || !/^https?:\/\//i.test(url)) return null;
  if (node.type !== 'image' && node.type !== 'video') return null;

  const kind: 'image' | 'video' =
    node.type === 'video' || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url) ? 'video' : 'image';

  const modelId = String(data.modelId || '');
  const modelName = String(data._modelName || data.modelName || modelId || '');
  const resolution = String(data.resolution || '').trim();
  const ratio = String(data.ratio || '').trim();
  const mode = String(data.mode || '').trim();
  const prompt = String(data.prompt || '').trim();
  const ended = typeof data.runEndedAt === 'number' ? data.runEndedAt : undefined;
  const created = ended ? Math.floor(ended / 1000) : undefined;

  return {
    id_base: node.id,
    type: kind,
    status: 'FINISH',
    prompt: prompt || undefined,
    model: modelName || modelId || undefined,
    modelInfo: modelName
      ? { name: modelName, model: modelId || undefined }
      : undefined,
    resolution: resolution || undefined,
    ratio: ratio || undefined,
    mode: mode || undefined,
    thumbnail_url: url,
    download_url: url,
    created_time: created,
resolutions: [{ type: kind, status: 'FINISH', url, name: resolution || undefined }],
};
}

/** Tất cả kết quả gen đã xong trên canvas, cùng loại media. */
export function collectWorkflowPreviewItems(
  nodes: Node[],
  kind: 'image' | 'video',
): FeedItem[] {
  const items: FeedItem[] = [];
  for (const n of nodes) {
    const item = workflowNodeToFeedItem(n);
    if (!item) continue;
    if (item.type === kind) items.push(item);
  }
  return items;
}
