import type { Edge, Node } from '@xyflow/react';
import { authUserKey } from './authStore';

export interface WorkflowGroup {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavedTemplate {
  id: string;
  name: string;
  groupId: string | null;
  nodes: Node[];
  edges: Edge[];
  nodeCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Dữ liệu graph tối thiểu để lưu một template. */
export interface TemplateGraph {
  nodes: Node[];
  edges: Edge[];
}

export const WORKFLOW_GROUP_COLORS = [
  '#2dd4bf',
  '#a78bfa',
  '#fbbf24',
  '#f87171',
  '#34d399',
  '#60a5fa',
  '#f472b6',
  '#fb923c',
];

const EVENT = 'wf-library:updated';

function userKey(): string {
  return authUserKey();
}

function groupsKey(): string {
  return `ai_wf_groups:${userKey()}`;
}

function templatesKey(): string {
  return `ai_wf_templates:${userKey()}`;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function dispatch(): void {
  document.dispatchEvent(new CustomEvent(EVENT));
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Bỏ trạng thái chạy (status/resultUrl…) khi lưu template. */
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

/* ---------- Groups ---------- */

export function loadGroups(): WorkflowGroup[] {
  const arr = readJson<WorkflowGroup[]>(groupsKey(), []);
  return Array.isArray(arr) ? arr : [];
}

function saveGroups(list: WorkflowGroup[]): void {
  localStorage.setItem(groupsKey(), JSON.stringify(list));
}

export function createGroup(name: string, color?: string): WorkflowGroup {
  const list = loadGroups();
  const now = new Date().toISOString();
  const group: WorkflowGroup = {
    id: newId('wfg'),
    name: name.trim() || 'Nhóm mới',
    color: color || WORKFLOW_GROUP_COLORS[list.length % WORKFLOW_GROUP_COLORS.length],
    createdAt: now,
    updatedAt: now,
  };
  saveGroups([group, ...list]);
  dispatch();
  return group;
}

export function updateGroup(
  id: string,
  patch: Partial<Pick<WorkflowGroup, 'name' | 'color'>>,
): void {
  const list = loadGroups().map((g) =>
    g.id === id
      ? {
          ...g,
          name: patch.name != null ? patch.name.trim() || g.name : g.name,
          color: patch.color ?? g.color,
          updatedAt: new Date().toISOString(),
        }
      : g,
  );
  saveGroups(list);
  dispatch();
}

export function deleteGroup(id: string): void {
  saveGroups(loadGroups().filter((g) => g.id !== id));
  // Template thuộc nhóm bị xóa thì chuyển về "chưa phân nhóm"
  const templates = loadTemplates().map((t) => (t.groupId === id ? { ...t, groupId: null } : t));
  saveTemplates(templates);
  dispatch();
}

/* ---------- Templates ---------- */

export function loadTemplates(): SavedTemplate[] {
  const arr = readJson<SavedTemplate[]>(templatesKey(), []);
  return Array.isArray(arr) ? arr : [];
}

function saveTemplates(list: SavedTemplate[]): void {
  localStorage.setItem(templatesKey(), JSON.stringify(list));
}

export function saveTemplate(
  name: string,
  graph: TemplateGraph,
  groupId: string | null = null,
): SavedTemplate {
  const nodes = stripRuntime(graph.nodes);
  const now = new Date().toISOString();
  const template: SavedTemplate = {
    id: newId('wft'),
    name: name.trim() || 'Workflow mới',
    groupId,
    nodes,
    edges: graph.edges,
    nodeCount: nodes.length,
    createdAt: now,
    updatedAt: now,
  };
  saveTemplates([template, ...loadTemplates()]);
  dispatch();
  return template;
}

export function renameTemplate(id: string, name: string): void {
  const list = loadTemplates().map((t) =>
    t.id === id ? { ...t, name: name.trim() || t.name, updatedAt: new Date().toISOString() } : t,
  );
  saveTemplates(list);
  dispatch();
}

export function deleteTemplate(id: string): void {
  saveTemplates(loadTemplates().filter((t) => t.id !== id));
  dispatch();
}

export function assignTemplateToGroup(id: string, groupId: string | null): void {
  const list = loadTemplates().map((t) =>
    t.id === id ? { ...t, groupId, updatedAt: new Date().toISOString() } : t,
  );
  saveTemplates(list);
  dispatch();
}

export function getTemplate(id: string): SavedTemplate | null {
  return loadTemplates().find((t) => t.id === id) ?? null;
}

export function listTemplates(groupId: string | null | undefined): SavedTemplate[] {
  const all = loadTemplates();
  const scoped = groupId ? all.filter((t) => t.groupId === groupId) : all;
  return scoped
    .slice()
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function countByGroup(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const t of loadTemplates()) {
    if (t.groupId) counts[t.groupId] = (counts[t.groupId] ?? 0) + 1;
  }
  return counts;
}

export function onLibraryUpdated(handler: () => void): () => void {
  document.addEventListener(EVENT, handler);
  return () => document.removeEventListener(EVENT, handler);
}
