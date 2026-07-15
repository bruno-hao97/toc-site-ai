import type { Edge, Node } from '@xyflow/react';
import { authUserKey } from './authStore';
import { loadWorkflow } from './workflowStore';

export interface WorkflowTab {
  id: string;
  name: string;
  templateId?: string | null;
  nodes: Node[];
  edges: Edge[];
  pinned: boolean;
  updatedAt: string;
}

export interface TabsState {
  tabs: WorkflowTab[];
  activeId: string;
}

const EVENT = 'wf-tabs:updated';

function userKey(): string {
  return authUserKey();
}

function tabsKey(): string {
  return `ai_wf_tabs:${userKey()}`;
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Bỏ trạng thái chạy khỏi node trước khi lưu. */
function stripRuntime(nodes: Node[]): Node[] {
  return nodes.map((n) => {
    const data = (n.data ?? {}) as Record<string, unknown>;
    const { status, statusText, resultUrl, error, ...rest } = data;
    void status;
    void statusText;
    void resultUrl;
    void error;
    return { id: n.id, type: n.type, position: n.position, data: rest } as Node;
  });
}

export function makeTab(
  name: string,
  graph: { nodes: Node[]; edges: Edge[] },
  templateId: string | null = null,
): WorkflowTab {
  return {
    id: newId('wftab'),
    name: name.trim() || 'Workflow mới',
    templateId,
    nodes: stripRuntime(graph.nodes),
    edges: graph.edges,
    pinned: false,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Tải danh sách tab. Nếu chưa có, tạo tab đầu tiên từ canvas cũ (workflowStore)
 * hoặc từ graph mặc định truyền vào.
 */
export function loadTabsState(fallbackGraph: { nodes: Node[]; edges: Edge[] }): TabsState {
  try {
    const raw = localStorage.getItem(tabsKey());
    if (raw) {
      const parsed = JSON.parse(raw) as TabsState;
      if (parsed && Array.isArray(parsed.tabs) && parsed.tabs.length) {
        const activeId = parsed.tabs.some((t) => t.id === parsed.activeId)
          ? parsed.activeId
          : parsed.tabs[0].id;
        return { tabs: parsed.tabs, activeId };
      }
    }
  } catch {
    /* ignore */
  }

  // Migrate: canvas cũ → tab đầu tiên
  const legacy = loadWorkflow();
  const graph = legacy && legacy.nodes.length ? { nodes: legacy.nodes, edges: legacy.edges } : fallbackGraph;
  const first = makeTab('Workflow 1', graph);
  const state: TabsState = { tabs: [first], activeId: first.id };
  saveTabsState(state);
  return state;
}

export function saveTabsState(state: TabsState): void {
  const clean: TabsState = {
    activeId: state.activeId,
    tabs: state.tabs.map((t) => ({ ...t, nodes: stripRuntime(t.nodes) })),
  };
  localStorage.setItem(tabsKey(), JSON.stringify(clean));
  document.dispatchEvent(new CustomEvent(EVENT));
}

export function onTabsUpdated(handler: () => void): () => void {
  document.addEventListener(EVENT, handler);
  return () => document.removeEventListener(EVENT, handler);
}
