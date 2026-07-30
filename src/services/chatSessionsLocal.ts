import { authUserKey } from './authStore';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
}

export interface ChatSessionSummary {
  sessionId: string;
  title: string;
  updatedAt: number;
}

export interface ChatSessionData extends ChatSessionSummary {
  messages: ChatMessage[];
}

const MAX_SESSIONS = 80;
const EVENT = 'chat-sessions:updated';

function storageKey(): string {
  return `chat_sessions_v1:${authUserKey()}`;
}

function loadAll(): ChatSessionData[] {
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatSessionData[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAll(sessions: ChatSessionData[]): void {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(sessions));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    /* ignore quota */
  }
}

export function sessionTitleFromMessages(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === 'user' && m.content.trim());
  if (!first) return 'Chat mới';
  const t = first.content.trim();
  return t.length > 48 ? `${t.slice(0, 48)}…` : t;
}

export function listChatSessions(): ChatSessionSummary[] {
  return loadAll()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(({ sessionId, title, updatedAt }) => ({ sessionId, title, updatedAt }));
}

export function getChatSession(sessionId: string): ChatSessionData | null {
  return loadAll().find((s) => s.sessionId === sessionId) ?? null;
}

export function upsertChatSession(data: ChatSessionData): void {
  let all = loadAll().filter((s) => s.sessionId !== data.sessionId);
  all.unshift(data);
  if (all.length > MAX_SESSIONS) all = all.slice(0, MAX_SESSIONS);
  saveAll(all);
}

export function deleteChatSession(sessionId: string): void {
  saveAll(loadAll().filter((s) => s.sessionId !== sessionId));
}

export function onChatSessionsUpdated(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}
