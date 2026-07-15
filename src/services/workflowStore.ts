import type { Edge, Node } from '@xyflow/react';

const KEY = 'ai_workflow_current';

export interface SavedWorkflow {
  nodes: Node[];
  edges: Edge[];
  updatedAt: string;
}

export function loadWorkflow(): SavedWorkflow | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedWorkflow;
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveWorkflow(nodes: Node[], edges: Edge[]): void {
  const data: SavedWorkflow = {
    nodes: nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: stripRuntime(n.data) })),
    edges,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function clearWorkflow(): void {
  localStorage.removeItem(KEY);
}

/** Bỏ trạng thái chạy (status/resultUrl…) khi lưu để lần mở sau không kẹt trạng thái cũ. */
function stripRuntime(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object') return {};
  const { status, statusText, resultUrl, error, ...rest } = data as Record<string, unknown>;
  void status;
  void statusText;
  void resultUrl;
  void error;
  return rest;
}
