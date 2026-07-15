import { loadAuth } from './authStore';
import { DEFAULT_DOMAIN } from './settingsStore';
import { GOMMO_CHAT_CONFIG, type GommoChatConfig } from './gommoChatConfig';

export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

export interface AskOptions {
  /** Lịch sử hội thoại TRƯỚC lượt hiện tại (đã convert role user/model). */
  history: ChatTurn[];
  /** Là lượt đầu của phiên (để chèn system prompt). */
  firstTurn?: boolean;
  /** Id phiên dùng chung cho cả 3 API. */
  sessionId: string;
  /** Snapshot JSON graph hiện tại (gửi kèm cho model). */
  workflowSnapshot?: string;
  onDelta?: (chunk: string) => void;
  signal?: AbortSignal;
  config?: Partial<GommoChatConfig>;
}

/** Đã đăng nhập Gommo (có access_token) thì mới chat được. */
export function isGommoChatConfigured(): boolean {
  return Boolean(loadAuth()?.access_token?.trim());
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function serializeMessages(history: ChatTurn[]): string {
  return JSON.stringify(
    history.map((t) => ({ role: t.role, text: t.text, attachments: [] })),
  );
}

/** API 1 & 3 — lưu tin nhắn (best-effort, không chặn câu trả lời). */
async function saveMessage(
  cfg: GommoChatConfig,
  token: string,
  domain: string,
  args: { messageId: string; sessionId: string; role: 'user' | 'model'; text: string; metadata: Record<string, unknown> },
): Promise<void> {
  try {
    const form = new URLSearchParams();
    form.set('action', 'save_message');
    form.set('access_token', token);
    form.set('domain', domain);
    form.set('message_id', args.messageId);
    form.set('session_id', args.sessionId);
    form.set('role', args.role);
    form.set('text', args.text);
    form.set('attachments', '[]');
    form.set('timestamp', String(Date.now()));
    form.set('metadata', JSON.stringify(args.metadata));
    form.set('device_id', cfg.deviceId);
    form.set('device_name', cfg.deviceName);
    await fetch(`${cfg.baseUrl}/ai-chat-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
  } catch (err) {
    console.warn('[gommoChat] save_message failed (bỏ qua):', err);
  }
}

/**
 * Gửi 1 lượt chat tới Gommo, stream từng chữ qua onDelta, trả về câu trả lời đầy đủ.
 * Ném Error nếu chưa đăng nhập, lỗi mạng, hoặc lỗi mềm (token/tham số sai).
 */
export async function askGommo(userText: string, opts: AskOptions): Promise<string> {
  const auth = loadAuth();
  if (!auth?.access_token) {
    throw new Error('Chưa đăng nhập Gommo — không thể chat.');
  }
  const cfg: GommoChatConfig = { ...GOMMO_CHAT_CONFIG, ...opts.config };
  const token = auth.access_token;
  const domain = auth.domain || DEFAULT_DOMAIN;

  const userMessageId = uuid();
  const assistantMessageId = uuid();

  // System prompt chỉ chèn lượt đầu; snapshot canvas gửi kèm mỗi lượt.
  const snapshotBlock = opts.workflowSnapshot
    ? `\n\n[Canvas hiện tại]\n${opts.workflowSnapshot}`
    : '';
  const sendText =
    (opts.firstTurn && cfg.systemPrompt ? `${cfg.systemPrompt}\n\n` : '') +
    userText +
    snapshotBlock;

  const fullHistory: ChatTurn[] = [...opts.history, { role: 'user', text: sendText }];

  // Timeout: linked abort + tự hủy sau timeoutMs.
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), cfg.timeoutMs);
  const onExternalAbort = () => ac.abort();
  opts.signal?.addEventListener('abort', onExternalAbort);

  try {
    if (cfg.persistHistory) {
      await saveMessage(cfg, token, domain, {
        messageId: userMessageId,
        sessionId: opts.sessionId,
        role: 'user',
        text: userText,
        metadata: { version: 1 },
      });
    }

    const form = new URLSearchParams();
    form.set('action', 'stream');
    form.set('access_token', token);
    form.set('domain', domain);
    form.set('server', cfg.server);
    form.set('model', cfg.model);
    form.set('mode', cfg.model);
    form.set('body_type', 'chat_completions');
    form.set('agent_id', cfg.agentId);
    form.set('session_id', opts.sessionId);
    form.set('project_id', cfg.projectId);
    form.set('user_message_id', userMessageId);
    form.set('assistant_message_id', assistantMessageId);
    form.set('messages', serializeMessages(fullHistory));
    form.set('device_id', cfg.deviceId);
    form.set('device_name', cfg.deviceName);

    const res = await fetch(`${cfg.baseUrl}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      signal: ac.signal,
    });

    if (!res.ok) {
      throw new Error(`Gommo chat lỗi HTTP ${res.status}`);
    }

    // LỖI MỀM: 200 nhưng JSON (token/tham số sai).
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const j = (await res.json()) as { error?: number; message?: string };
      throw new Error(`${j.message ?? 'Gommo từ chối yêu cầu'} (error ${j.error ?? '?'})`);
    }

    if (!res.body) {
      throw new Error('Gommo không trả về luồng dữ liệu.');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let reply = '';

    const consumeLine = (line: string): boolean => {
      // Bỏ qua "event: usage" và dòng không phải data.
      if (!line.startsWith('data:')) return false;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') return true;
      try {
        const json = JSON.parse(payload) as {
          choices?: { delta?: { content?: string | null } }[];
        };
        const content = json.choices?.[0]?.delta?.content;
        if (content) {
          reply += content;
          opts.onDelta?.(content);
        }
      } catch {
        // Bỏ qua dòng không parse được.
      }
      return false;
    };

    let done = false;
    while (!done) {
      const { done: streamDone, value } = await reader.read();
      if (streamDone) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (consumeLine(line.trim())) {
          done = true;
          break;
        }
      }
    }
    if (!done && buffer.trim()) consumeLine(buffer.trim());

    if (cfg.persistHistory) {
      await saveMessage(cfg, token, domain, {
        messageId: assistantMessageId,
        sessionId: opts.sessionId,
        role: 'model',
        text: reply,
        metadata: {
          version: 1,
          agentId: cfg.agentId,
          model: cfg.model,
          server: cfg.server,
        },
      });
    }

    return reply;
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onExternalAbort);
  }
}
