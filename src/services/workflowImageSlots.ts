import type { Edge, Node } from '@xyflow/react';
import { draftFromNodeData, isHttpUrl } from './workflowMediaInput';

function readStoredSlot(node: Node): number | undefined {
  const raw = (node.data as Record<string, unknown> | undefined)?.imageSlot;
  if (typeof raw === 'number' && raw > 0) return Math.floor(raw);
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return parseInt(raw, 10);
  return undefined;
}

/** Node Nhập ảnh theo thứ tự trong graph (JSON / mảng nodes), không sort theo canvas. */
export function listImageInputNodes(nodes: Node[]): Node[] {
  return nodes.filter((n) => n.type === 'input-image');
}

/** Slot 1-based — ưu tiên `data.imageSlot` (vmedia / import), fallback thứ tự document. */
export function getImageSlotForNode(nodeId: string, nodes: Node[]): number {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return 1;
  const stored = readStoredSlot(node);
  if (stored) return stored;
  const list = listImageInputNodes(nodes);
  const idx = list.findIndex((n) => n.id === nodeId);
  return idx >= 0 ? idx + 1 : 1;
}

/** Gán imageSlot 1..n theo thứ tự document cho workflow cũ chưa có slot. */
export function ensureImageSlots<T extends Node>(nodes: T[]): T[] {
  const ordered = listImageInputNodes(nodes);
  if (ordered.length === 0) return nodes;
  if (ordered.every((n) => readStoredSlot(n))) return nodes;

  const slotById = new Map<string, number>();
  ordered.forEach((n, i) => slotById.set(n.id, i + 1));

  return nodes.map((n) => {
    const slot = slotById.get(n.id);
    if (!slot) return n;
    return { ...n, data: { ...n.data, imageSlot: slot } };
  });
}

/** Slot tiếp theo khi thêm node Nhập ảnh mới. */
export function nextImageSlot(nodes: Node[]): number {
  let max = 0;
  for (const n of listImageInputNodes(nodes)) {
    const s = readStoredSlot(n) ?? getImageSlotForNode(n.id, nodes);
    max = Math.max(max, s);
  }
  return max + 1;
}

export function imageSlotLabel(slot: number): string {
  return `@image${slot}`;
}

export function nodeBadgeLabel(slot: number): string {
  return `N${slot}`;
}

export function parseImageSlotsFromPrompt(prompt: string): number[] {
  const slots: number[] = [];
  const seen = new Set<number>();
  for (const m of prompt.matchAll(/@image(\d+)/gi)) {
    const n = parseInt(m[1], 10);
    if (n > 0 && !seen.has(n)) {
      seen.add(n);
      slots.push(n);
    }
  }
  return slots;
}

function primaryUrlForInputImageNode(
  node: Node,
  outputs: Record<string, string>,
  outputByHandle: Record<string, Record<string, string>>,
): string {
  const fromHandle = outputByHandle[node.id]?.['media-out'];
  if (fromHandle && isHttpUrl(fromHandle)) return fromHandle;

  const fromOutput = outputs[node.id];
  if (fromOutput && isHttpUrl(fromOutput)) return fromOutput;

  const draft = draftFromNodeData(node.data as Record<string, unknown>);
  const local = draft.mediaUrls.find(isHttpUrl);
  return local || '';
}

/** Map slot → URL ảnh (sau khi node Nhập ảnh đã chạy hoặc từ data local). */
export function buildImageSlotRegistry(
  nodes: Node[],
  outputs: Record<string, string>,
  outputByHandle: Record<string, Record<string, string>>,
): Map<number, string> {
  const map = new Map<number, string>();
  for (const n of listImageInputNodes(nodes)) {
    const slot = getImageSlotForNode(n.id, nodes);
    const url = primaryUrlForInputImageNode(n, outputs, outputByHandle);
    if (url) map.set(slot, url);
  }
  return map;
}

/** Lấy URL references theo thứ tự @imageN xuất hiện trong prompt. */
export function resolveImageReferencesFromPrompt(
  prompt: string,
  registry: Map<number, string>,
): string[] {
  const slots = parseImageSlotsFromPrompt(prompt);
  if (!slots.length) return [];
  return slots
    .map((s) => registry.get(s))
    .filter((u): u is string => Boolean(u && isHttpUrl(u)));
}

/** URL từ các edge nối vào cổng ref, sắp theo slot nguồn. */
export function collectWiredRefUrlsBySlot(
  targetNodeId: string,
  edges: Edge[],
  nodes: Node[],
  resolveEdgeOutput: (edge: Edge) => string | undefined,
): string[] {
  return edges
    .filter((e) => e.target === targetNodeId && (e.targetHandle ?? null) === 'ref')
    .map((e) => {
      const source = nodes.find((n) => n.id === e.source);
      const slot =
        source?.type === 'input-image' ? getImageSlotForNode(e.source, nodes) : 10_000;
      const url = resolveEdgeOutput(e);
      return { slot, url };
    })
    .filter((x): x is { slot: number; url: string } => Boolean(x.url && isHttpUrl(x.url)))
    .sort((a, b) => a.slot - b.slot)
    .map((x) => x.url);
}

export function resolveImageReferencesForJob(opts: {
  prompt: string;
  nodes: Node[];
  outputs: Record<string, string>;
  outputByHandle: Record<string, Record<string, string>>;
  targetNodeId: string;
  edges: Edge[];
  resolveEdgeOutput: (edge: Edge) => string | undefined;
  fallbackUrl?: string;
}): string[] {
  const registry = buildImageSlotRegistry(opts.nodes, opts.outputs, opts.outputByHandle);
  const fromPrompt = resolveImageReferencesFromPrompt(opts.prompt, registry);
  if (fromPrompt.length) return fromPrompt;

  const fromWires = collectWiredRefUrlsBySlot(
    opts.targetNodeId,
    opts.edges,
    opts.nodes,
    opts.resolveEdgeOutput,
  );
  if (fromWires.length) return fromWires;

  if (opts.fallbackUrl && isHttpUrl(opts.fallbackUrl)) return [opts.fallbackUrl];
  return [];
}
