import { authUserKey } from './authStore';
import type { WorkflowAgentAction } from './workflowAgentActions';

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  /** Action dự kiến parse từ câu trả lời. */
  actions?: WorkflowAgentAction[];
  actionsApplied?: boolean;
  /** Số action đã apply (banner 79AI). */
  appliedCount?: number;
}

export interface DirectCreateSettings {
  kind: 'image' | 'video';
  model: string;
  ratio: string;
  resolution: string;
  duration: string;
  mode: string;
}

export interface AgentChatModel {
  id: string;
  name: string;
  desc: string;
  server: string;
  model: string;
}

/** Model chat Agent — khớp danh sách 79AI Moon Agent. */
export const AGENT_CHAT_MODELS = [
  {
    id: 'composer-2.5-standard',
    name: 'Composer 2.5 (Standard)',
    desc: 'cursorai · Cursor Composer 2.5: code nhanh, agent workflow, giá tiêu chuẩn.',
    server: 'cursorai',
    model: 'composer-2.5',
  },
  {
    id: 'composer-2.5-fast',
    name: 'Composer 2.5 (Fast)',
    desc: 'cursorai · Composer 2.5 Fast: phản hồi nhanh, phù hợp chỉnh workflow.',
    server: 'cursorai',
    model: 'composer-2.5-fast',
  },
  {
    id: 'gpt-5.5-cheap',
    name: 'GPT-5.5 Cheap',
    desc: 'openai · GPT-5.5 rẻ, cân bằng chất lượng và chi phí.',
    server: 'openai',
    model: 'gpt-5.5-cheap',
  },
  {
    id: 'deepseek-v4-pro',
    name: 'DeepSeek V4 Pro',
    desc: 'deepseek · DeepSeek V4 Pro: suy luận mạnh, prompt dài.',
    server: 'deepseek',
    model: 'deepseek-v4-pro',
  },
  {
    id: 'glm-5.2-vip',
    name: 'GLM-5.2 VIP',
    desc: 'zhipu · GLM-5.2 VIP: tiếng Việt tốt, agent đa bước.',
    server: 'zhipu',
    model: 'glm-5.2-vip',
  },
] as const satisfies readonly AgentChatModel[];

export type AgentChatModelId = (typeof AGENT_CHAT_MODELS)[number]['id'];

export function resolveAgentChatModel(modelId?: string): AgentChatModel {
  return AGENT_CHAT_MODELS.find((m) => m.id === modelId) ?? AGENT_CHAT_MODELS[1];
}

export interface AgentSession {
  id: string;
  name: string;
  messages: AgentMessage[];
  createdAt: string;
}

export interface AgentState {
  sessions: AgentSession[];
  activeSessionId: string;
  autoMode: boolean;
  chatModelId: AgentChatModelId;
  directCreate: DirectCreateSettings;
}

const EVENT = 'wf-agent:updated';

const DEFAULT_DIRECT: DirectCreateSettings = {
  kind: 'video',
  model: 'veo-omni',
  ratio: '16:9',
  resolution: '720p',
  duration: '4s',
  mode: 'Flash',
};

function userKey(): string {
  return authUserKey();
}

function storageKey(): string {
  return `ai_wf_agent:${userKey()}`;
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function welcomeMessage(): AgentMessage {
  return {
    id: newId('msg'),
    role: 'assistant',
    content:
      'Xin chào! Tôi là **Moon Agent** — giúp bạn tạo và chỉnh workflow trên canvas.\n\n' +
      'Mô tả workflow bạn muốn (vd: tạo ảnh từ prompt → xuất kết quả), tôi sẽ áp dụng lên canvas.',
    createdAt: new Date().toISOString(),
  };
}

export function makeSession(name?: string): AgentSession {
  return {
    id: newId('sess'),
    name: name || 'Phiên mới',
    messages: [welcomeMessage()],
    createdAt: new Date().toISOString(),
  };
}

function defaultState(): AgentState {
  const first = makeSession('Phiên 1');
  return {
    sessions: [first],
    activeSessionId: first.id,
    autoMode: true,
    chatModelId: 'composer-2.5-fast',
    directCreate: { ...DEFAULT_DIRECT },
  };
}

export function loadAgentState(): AgentState {
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as AgentState;
    if (!parsed.sessions?.length) return defaultState();
    return {
      ...defaultState(),
      ...parsed,
      chatModelId: resolveAgentChatModel(parsed.chatModelId).id,
      directCreate: { ...DEFAULT_DIRECT, ...parsed.directCreate },
    };
  } catch {
    return defaultState();
  }
}

export function saveAgentState(state: AgentState): void {
  localStorage.setItem(storageKey(), JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function onAgentUpdated(fn: () => void): () => void {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}

export function getActiveSession(state: AgentState): AgentSession {
  return state.sessions.find((s) => s.id === state.activeSessionId) ?? state.sessions[0];
}

/** Phản hồi mock — thay bằng LLM sau. */
export function mockAgentReply(
  userText: string,
  ctx: { nodeCount: number; edgeCount: number; tabName: string },
): string {
  const t = userText.toLowerCase();
  if (t.includes('ảnh') || t.includes('image')) {
    return (
      `Gợi ý workflow tạo ảnh cho tab **${ctx.tabName}**:\n\n` +
      `1. **Bắt đầu** → **Tạo ảnh** (prompt)\n` +
      `2. **Xử lý ảnh** (tuỳ chọn upscale)\n` +
      `3. **Kết quả**\n\n` +
      `Hiện canvas có **${ctx.nodeCount} node**, **${ctx.edgeCount}** kết nối. ` +
      `Bạn có thể kéo node từ palette bên trái hoặc mô tả chi tiết hơn để tôi gợi ý tiếp.`
    );
  }
  if (t.includes('video')) {
    return (
      `Workflow video gợi ý:\n\n` +
      `**Bắt đầu** → **Tạo video** → **Kết quả**\n\n` +
      `Cài đặt tạo trực tiếp (nút ⚙ cạnh Auto): model **${DEFAULT_DIRECT.model}**, ` +
      `tỷ lệ **${DEFAULT_DIRECT.ratio}**, **${DEFAULT_DIRECT.duration}**.`
    );
  }
  if (t.includes('tối ưu') || t.includes('toiuu') || t.includes('optimize')) {
    return (
      `Để tối ưu workflow hiện tại:\n\n` +
      `- Gom node liên tiếp không cần nhánh\n` +
      `- Dùng **Sắp xếp tự động** ở thanh dưới\n` +
      `- Kiểm tra mỗi node AI đã chọn model phù hợp\n\n` +
      `Canvas: **${ctx.nodeCount}** node, **${ctx.edgeCount}** edge.`
    );
  }
  return (
    `Đã nhận yêu cầu cho tab **${ctx.tabName}**.\n\n` +
    `Tôi đang ở chế độ demo — mô tả rõ hơn (tạo ảnh, video, điều kiện, lặp…) ` +
    `để nhận gợi ý workflow. Khi nối AI thật, tôi có thể đề xuất và chỉnh sơ đồ trực tiếp.`
  );
}

export const DIRECT_MODELS = {
  image: [
    { id: 'flux-pro', name: 'Flux Pro', desc: 'Tạo ảnh chất lượng cao, phù hợp prompt chi tiết.' },
    { id: 'sdxl', name: 'SDXL', desc: 'Model ổn định, nhanh cho ảnh tổng quát.' },
  ],
  video: [
    {
      id: 'veo-omni',
      name: 'VEO - Omni',
      desc: 'Model VEO Omni — tạo video thế hệ mới từ Google, hỗ trợ nhiều tỷ lệ.',
    },
    { id: 'kling', name: 'Kling', desc: 'Video ngắn chuyển động mượt, phù hợp social.' },
  ],
} as const;

export const DIRECT_RATIOS = ['16:9', '9:16'] as const;
export const DIRECT_RESOLUTIONS = ['720p', '1080p', '4k'] as const;
export const DIRECT_DURATIONS = ['4s', '6s', '8s', '10s'] as const;
export const DIRECT_MODES = ['Flash'] as const;
