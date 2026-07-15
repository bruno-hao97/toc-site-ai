import { authUserKey } from './authStore';

export interface Project {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export type ProjectItemType = 'image' | 'video' | 'tts' | 'music' | string;

export interface ProjectItem {
  itemId: string;
  projectId: string;
  type: ProjectItemType;
  prompt?: string;
  thumbnailUrl?: string;
  downloadUrl?: string;
  createdTime?: string | number;
  addedAt: string;
}

/** Dữ liệu tối thiểu để gắn một item Gommo vào project. */
export type ProjectItemSnapshot = Omit<ProjectItem, 'projectId' | 'addedAt'>;

export const PROJECT_COLORS = [
  '#2dd4bf',
  '#60a5fa',
  '#a78bfa',
  '#f472b6',
  '#fbbf24',
  '#34d399',
  '#f87171',
  '#38bdf8',
];

const EVENT = 'projects:updated';

function userKey(): string {
  return authUserKey();
}

function projectsKey(): string {
  return `ai_projects:${userKey()}`;
}

function itemsKey(): string {
  return `ai_project_items:${userKey()}`;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed as T;
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

export function loadProjects(): Project[] {
  const arr = readJson<Project[]>(projectsKey(), []);
  return Array.isArray(arr) ? arr : [];
}

function saveProjects(list: Project[]): void {
  localStorage.setItem(projectsKey(), JSON.stringify(list));
}

export function loadProjectItems(): ProjectItem[] {
  const arr = readJson<ProjectItem[]>(itemsKey(), []);
  return Array.isArray(arr) ? arr : [];
}

function saveProjectItems(list: ProjectItem[]): void {
  localStorage.setItem(itemsKey(), JSON.stringify(list));
}

export function createProject(name: string, color?: string): Project {
  const list = loadProjects();
  const now = new Date().toISOString();
  const project: Project = {
    id: newId('proj'),
    name: name.trim() || 'Dự án mới',
    color: color || PROJECT_COLORS[list.length % PROJECT_COLORS.length],
    createdAt: now,
    updatedAt: now,
  };
  saveProjects([project, ...list]);
  dispatch();
  return project;
}

export function updateProject(id: string, patch: Partial<Pick<Project, 'name' | 'color'>>): void {
  const list = loadProjects().map((p) =>
    p.id === id
      ? {
          ...p,
          name: patch.name != null ? patch.name.trim() || p.name : p.name,
          color: patch.color ?? p.color,
          updatedAt: new Date().toISOString(),
        }
      : p,
  );
  saveProjects(list);
  dispatch();
}

export function deleteProject(id: string): void {
  saveProjects(loadProjects().filter((p) => p.id !== id));
  saveProjectItems(loadProjectItems().filter((it) => it.projectId !== id));
  dispatch();
}

/** Item chỉ thuộc 1 project: gán = upsert (ghi đè project cũ nếu có). */
export function assignItem(snapshot: ProjectItemSnapshot, projectId: string): void {
  const rest = loadProjectItems().filter((it) => it.itemId !== snapshot.itemId);
  const record: ProjectItem = {
    ...snapshot,
    projectId,
    addedAt: new Date().toISOString(),
  };
  saveProjectItems([record, ...rest]);
  dispatch();
}

export function removeItem(itemId: string): void {
  saveProjectItems(loadProjectItems().filter((it) => it.itemId !== itemId));
  dispatch();
}

export function getItemProjectId(itemId: string): string | null {
  return loadProjectItems().find((it) => it.itemId === itemId)?.projectId ?? null;
}

export function listItemsByProject(projectId: string | null): ProjectItem[] {
  const all = loadProjectItems();
  const scoped = projectId ? all.filter((it) => it.projectId === projectId) : all;
  return scoped.slice().sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
}

export function countByProject(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const it of loadProjectItems()) {
    counts[it.projectId] = (counts[it.projectId] ?? 0) + 1;
  }
  return counts;
}

export function totalAssigned(): number {
  return loadProjectItems().length;
}

export function onProjectsUpdated(handler: () => void): () => void {
  document.addEventListener(EVENT, handler);
  return () => document.removeEventListener(EVENT, handler);
}
