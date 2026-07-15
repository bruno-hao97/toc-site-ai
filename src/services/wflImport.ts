import type { Edge, Node } from '@xyflow/react';
import type { TemplateGraph } from './workflowLibraryStore';

/** Node theo định dạng file .wfl (79ai-workflow) export từ vmedia. */
interface WflNode {
  id: string;
  type: string;
  position?: { x: number; y: number };
  data?: Record<string, unknown>;
}

interface WflConnection {
  id?: string;
  sourceNodeId: string;
  sourcePortId?: string;
  targetNodeId: string;
  targetPortId?: string;
}

interface WflFile {
  type?: string;
  version?: number;
  name?: string;
  nodes?: WflNode[];
  connections?: WflConnection[];
}

export interface WflImportResult {
  name: string;
  graph: TemplateGraph;
}

/** Map type node WFL → type node nội bộ của app. */
const NODE_TYPE_MAP: Record<string, string> = {
  start: 'start',
  end: 'end',
  'image-input': 'input-image',
  'video-input': 'input-video',
  'generate-image': 'image',
  'generate-video': 'video',
  'generate-tts': 'tts',
  'generate-music': 'music',
  'text-input': 'text',
  text: 'text',
  'render-video': 'render',
  'upscale-image': 'upscale-image',
  lipsync: 'lipsync',
  'avatar-lipsync': 'lipsync',
  merge: 'merge',
  'merge-data': 'merge',
  'extract-media': 'extract-media',
  agent: 'agent',
  'ai-agent': 'agent',
  'remove-bg': 'remove-bg',
  'upscale-video': 'upscale-video',
  vfx: 'vfx',
  subtitle: 'subtitle',
  'video-cut': 'cut',
  cut: 'cut',
  kols: 'kols',
  'data-table': 'data-table',
  output: 'output',
  note: 'note',
  'api-call': 'api',
};

const MEDIA_NODE_TYPES = new Set(['input-image', 'input-video']);
const AI_GEN_NODE_TYPES = new Set(['image', 'video']);
const MEDIA_OUTPUT_NODE_TYPES = new Set([
  ...MEDIA_NODE_TYPES,
  'image',
  'video',
  'upscale-image',
  'remove-bg',
  'upscale-video',
  'vfx',
  'subtitle',
  'cut',
  'lipsync',
]);

function isWflFile(value: unknown): value is WflFile {
  if (!value || typeof value !== 'object') return false;
  const v = value as WflFile;
  return Array.isArray(v.nodes);
}

/** Chuyển data node WFL sang data node nội bộ. */
function convertNodeData(type: string, data: Record<string, unknown>): Record<string, unknown> {
  const prompt = (data.prompt_text ?? data.prompt ?? '') as string;

  if (type === 'image' || type === 'video' || type === 'music') {
    return {
      prompt,
      modelId: (data.model as string) || '',
      ratio: data.ratio,
      resolution: data.resolution,
      mode: data.mode,
      duration: data.duration,
      _modelName: data.model_name,
    };
  }

  if (type === 'tts') {
    return { text: prompt, modelId: (data.model as string) || '' };
  }

  if (type === 'text') {
    return { prompt };
  }

  if (MEDIA_NODE_TYPES.has(type)) {
    const urls = Array.isArray(data.urls)
      ? (data.urls as string[])
      : data.url
        ? [data.url as string]
        : [];
    return {
      mediaUrls: urls,
      fileNames: urls.map(() => (data.label as string) || 'Đã import'),
      resultUrl: urls[0] || '',
      required: Boolean(data.required),
      configured: urls.length > 0,
      randomOutput: Boolean(data.random_output ?? data.randomOutput),
      randomMin: Number(data.random_min ?? data.randomMin) || 1,
      randomMax: Number(data.random_max ?? data.randomMax) || urls.length || 1,
      useOnce: Boolean(data.use_once ?? data.useOnce),
      sourceTab: 'url',
    };
  }

  if (type === 'note') {
    return { prompt };
  }

  if (type === 'render') {
    return {
      exportMode: data.export_mode,
      profile: data.profile,
      resolution: data.resolution,
    };
  }

  if (type === 'upscale-image') {
    return {
      modelId: (data.model as string) || '',
      mode: data.mode,
      resolution: data.resolution,
    };
  }

  if (type === 'lipsync') {
    return {
      prompt,
      modelId: (data.model as string) || '',
    };
  }

  if (type === 'merge' || type === 'extract-media') {
    return {};
  }

  if (type === 'agent') {
    return {
      prompt,
      modelId: (data.model as string) || (data.chat_model as string) || '',
    };
  }

  if (
    type === 'remove-bg' ||
    type === 'upscale-video' ||
    type === 'vfx' ||
    type === 'subtitle' ||
    type === 'cut'
  ) {
    return {
      prompt,
      modelId: (data.model as string) || '',
      mode: data.mode,
      resolution: data.resolution,
      startSec: data.start_sec ?? data.startSec,
      endSec: data.end_sec ?? data.endSec,
    };
  }

  if (type === 'kols') {
    return {
      kolId: (data.kol_id as string) || (data.kolId as string) || '',
      customImageUrl: (data.image_url as string) || (data.url as string) || '',
    };
  }

  if (type === 'data-table') {
    return {
      tableRaw: (data.table_raw as string) || prompt,
      prompt: (data.table_raw as string) || prompt,
    };
  }

  if (type === 'output') {
    return {
      action: data.action,
      mode: data.mode,
      gridCols: data.gridCols,
    };
  }

  return { ...data };
}

/** Xác định handle nguồn/đích dựa trên type node để React Flow nối đúng. */
function resolveHandles(
  sourceType: string | undefined,
  targetType: string | undefined,
): { sourceHandle?: string; targetHandle?: string } {
  const sourceHandle = sourceType && MEDIA_NODE_TYPES.has(sourceType) ? 'media-out' : undefined;
  const targetHandle = targetType && MEDIA_NODE_TYPES.has(targetType) ? 'media-in' : undefined;
  return { sourceHandle, targetHandle };
}

function normalizeWflSourceHandle(
  sourceType: string | undefined,
  portId: string | undefined,
  fallback: string | undefined,
): string | undefined {
  if (!portId) return fallback;
  if (sourceType === 'start' && portId === 'trigger') return undefined;
  if ((portId === 'image' || portId === 'video') && sourceType && MEDIA_OUTPUT_NODE_TYPES.has(sourceType)) {
    return 'media-out';
  }
  return portId;
}

function normalizeWflTargetHandle(
  targetType: string | undefined,
  portId: string | undefined,
  fallback: string | undefined,
): string | undefined {
  if (!portId) return fallback;
  if ((portId === 'ref_image' || portId === 'image') && targetType && AI_GEN_NODE_TYPES.has(targetType)) {
    return 'ref';
  }
  return portId;
}

/** Parse chuỗi JSON file .wfl → graph nội bộ; throw nếu format sai. */
export function parseWflFile(raw: string): WflImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('File không phải JSON hợp lệ.');
  }
  if (!isWflFile(parsed)) {
    throw new Error('File không đúng định dạng workflow (thiếu danh sách nodes).');
  }

  const wfl = parsed;
  const typeById = new Map<string, string>();
  let imageSlotSeq = 0;

  const nodes: Node[] = (wfl.nodes ?? []).map((n) => {
    const mappedType = NODE_TYPE_MAP[n.type] ?? n.type;
    typeById.set(n.id, mappedType);
    const data = convertNodeData(mappedType, n.data ?? {});
    if (mappedType === 'input-image') {
      imageSlotSeq += 1;
      data.imageSlot = imageSlotSeq;
    }
    return {
      id: n.id,
      type: mappedType,
      position: n.position ?? { x: 0, y: 0 },
      data,
    } as Node;
  });

  const edges: Edge[] = (wfl.connections ?? []).map((c, i) => {
    const sourceType = typeById.get(c.sourceNodeId);
    const targetType = typeById.get(c.targetNodeId);
    const fallback = resolveHandles(sourceType, targetType);
    return {
      id: c.id || `wfl-edge-${i}`,
      source: c.sourceNodeId,
      target: c.targetNodeId,
      sourceHandle: normalizeWflSourceHandle(sourceType, c.sourcePortId, fallback.sourceHandle),
      targetHandle: normalizeWflTargetHandle(targetType, c.targetPortId, fallback.targetHandle),
      type: 'wf',
    } as Edge;
  });

  return {
    name: wfl.name?.trim() || 'Workflow import',
    graph: { nodes, edges },
  };
}
