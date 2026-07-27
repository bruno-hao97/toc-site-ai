import { authUserKey } from './authStore';
import { AGENT_CHAT_MODELS } from './workflowAgentStore';

export type ChatAiModelTag = 'Fast' | 'Cheap';

export interface ChatAiModel {
  id: string;
  name: string;
  provider: string;
  category: 'all' | 'coding';
  server: string;
  model: string;
  tags?: ChatAiModelTag[];
  salePercent?: number;
  selectable: boolean;
}

function providerForServer(server: string): string {
  switch (server) {
    case 'cheap':
    case 'openai':
      return 'OpenAI';
    case 'cursorai':
      return 'CursorAI';
    case 'deepseek':
      return 'DeepSeek';
    case 'zhipu':
      return 'ZAI';
    default:
      return server;
  }
}

function categoryForServer(server: string): 'all' | 'coding' {
  return server === 'cursorai' || server === 'deepseek' ? 'coding' : 'all';
}

function tagsForModel(model: string): ChatAiModelTag[] | undefined {
  const tags: ChatAiModelTag[] = [];
  if (/fast/i.test(model)) tags.push('Fast');
  if (/cheap/i.test(model)) tags.push('Cheap');
  return tags.length ? tags : undefined;
}

/**
 * Chỉ các cặp server/model đã chứng minh chạy trên Gommo `/chat`.
 * - Default route: `cheap` + `gpt-5.5::cheap` (GOMMO_CHAT_CONFIG)
 * - Moon Agent list: AGENT_CHAT_MODELS
 */
export const CHAT_AI_MODELS: ChatAiModel[] = [
  {
    id: 'gpt-5.5-cheap-default',
    name: 'GPT-5.5 Cheap',
    provider: 'OpenAI',
    category: 'all',
    server: 'cheap',
    model: 'gpt-5.5::cheap',
    tags: ['Cheap'],
    selectable: true,
  },
  // Bỏ gpt-5.5-cheap (openai) — trùng tên với default route `cheap` + `gpt-5.5::cheap`.
  ...AGENT_CHAT_MODELS.filter((m) => m.id !== 'gpt-5.5-cheap').map((m) => ({
    id: m.id,
    name: m.name,
    provider: providerForServer(m.server),
    category: categoryForServer(m.server),
    server: m.server,
    model: m.model,
    tags: tagsForModel(m.model),
    selectable: true as const,
  })),
];

/** Khớp GOMMO_CHAT_CONFIG mặc định (đã chạy ổn định). */
export const DEFAULT_CHAT_AI_MODEL_ID = 'gpt-5.5-cheap-default';

export interface ChatAiProviderNav {
  id: string;
  label: string;
  count: number;
}

export function listChatAiProviderNav(models: ChatAiModel[] = CHAT_AI_MODELS): ChatAiProviderNav[] {
  const coding = models.filter((m) => m.category === 'coding').length;
  const byProvider = new Map<string, number>();
  for (const m of models) {
    byProvider.set(m.provider, (byProvider.get(m.provider) ?? 0) + 1);
  }
  const providers = [...byProvider.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, count]) => ({ id: label, label, count }));

  return [
    { id: 'coding', label: 'For Coding', count: coding },
    { id: 'all', label: 'All', count: models.length },
    ...providers,
  ];
}

export function resolveChatAiModel(modelId?: string | null): ChatAiModel {
  return (
    CHAT_AI_MODELS.find((m) => m.id === modelId && m.selectable) ??
    CHAT_AI_MODELS.find((m) => m.id === DEFAULT_CHAT_AI_MODEL_ID)!
  );
}

function storageKey(): string {
  return `qc_chat_model:${authUserKey()}`;
}

export function loadQuickChatModelId(): string {
  try {
    const raw = localStorage.getItem(storageKey());
    if (raw && CHAT_AI_MODELS.some((m) => m.id === raw && m.selectable)) return raw;
    // Xóa id cũ (Gemini/Claude bịa…) để không kẹt lỗi error 1.
    if (raw) localStorage.removeItem(storageKey());
  } catch {
    /* ignore */
  }
  return DEFAULT_CHAT_AI_MODEL_ID;
}

export function saveQuickChatModelId(modelId: string): void {
  try {
    if (!CHAT_AI_MODELS.some((m) => m.id === modelId && m.selectable)) return;
    localStorage.setItem(storageKey(), modelId);
  } catch {
    /* ignore */
  }
}

export function filterChatAiModels(
  models: ChatAiModel[],
  opts: { providerId: string; query: string },
): ChatAiModel[] {
  const q = opts.query.trim().toLowerCase();
  return models.filter((m) => {
    if (!m.selectable) return false;
    if (opts.providerId === 'coding' && m.category !== 'coding') return false;
    if (opts.providerId !== 'all' && opts.providerId !== 'coding' && m.provider !== opts.providerId) {
      return false;
    }
    if (!q) return true;
    return (
      m.name.toLowerCase().includes(q) ||
      m.provider.toLowerCase().includes(q) ||
      m.model.toLowerCase().includes(q)
    );
  });
}

export function groupChatAiModelsByProvider(models: ChatAiModel[]): [string, ChatAiModel[]][] {
  const map = new Map<string, ChatAiModel[]>();
  for (const m of models) {
    const list = map.get(m.provider) ?? [];
    list.push(m);
    map.set(m.provider, list);
  }
  return [...map.entries()];
}
