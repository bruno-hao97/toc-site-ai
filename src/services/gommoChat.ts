import { CHAT_BRAND_IDENTITY } from '../lib/brand';
import { stripMoonVmediaBranding } from './stripChatMarkdown';
import { loadAuth, type AuthState } from './authStore';
import { DEFAULT_DOMAIN, DEFAULT_PROJECT_ID } from './settingsStore';
import {
  GOMMO_CHAT_CONFIG,
  MOON_CHAT_AGENT_ID,
  type GommoChatApiMode,
  type GommoChatConfig,
} from './gommoChatConfig';

/** Chat hội thoại (persistHistory) — luôn chèn quy tắc thương hiệu AGI. */
function resolveChatSystemPrompt(cfg: GommoChatConfig): string | undefined {
  const base = cfg.systemPrompt?.trim();
  if (cfg.persistHistory === false) return base || undefined;
  return base ? `${CHAT_BRAND_IDENTITY}\n\n${base}` : CHAT_BRAND_IDENTITY;
}

export interface ChatAttachment {
  type: 'image';
  url: string;
  name?: string;
  mime_type?: string;
}

export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
  attachments?: ChatAttachment[];
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
  /** Ảnh/file đính kèm của lượt user hiện tại. */
  attachments?: ChatAttachment[];
  onDelta?: (chunk: string) => void;
  signal?: AbortSignal;
  config?: Partial<GommoChatConfig>;
}

/** Chat: platform JWT hoặc Gommo access_token (passthrough giống vmedia). */
export function isGommoChatConfigured(): boolean {
  const auth = loadAuth();
  return Boolean(auth?.platform_token?.trim() || auth?.access_token?.trim());
}

/** Ưu tiên access_token user (vmedia) → Bearer passthrough; không thì JWT platform. */
function resolveChatCredentials(auth: AuthState): {
  bearerToken: string;
  accessTokenForForm: string;
  platformToken: string;
} {
  const accessToken = auth.access_token?.trim() || '';
  const platformToken = auth.platform_token?.trim() || '';
  if (accessToken) {
    return {
      bearerToken: accessToken,
      accessTokenForForm: accessToken,
      platformToken,
    };
  }
  if (platformToken) {
    return { bearerToken: platformToken, accessTokenForForm: '', platformToken };
  }
  throw new Error('Chưa đăng nhập — không thể chat.');
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
    history.map((t) => ({
      role: t.role,
      text: t.text,
      attachments: t.attachments?.length ? t.attachments : [],
    })),
  );
}

const VN_WEEKDAYS = [
  'Chủ Nhật',
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
] as const;

/** Chuỗi thời gian thực tế (Asia/Ho_Chi_Minh) để model không đoán ngày. */
export function formatVietnamNow(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';

  const weekdayEn = get('weekday'); // Mon, Tue, …
  const weekdayMap: Record<string, (typeof VN_WEEKDAYS)[number]> = {
    Sun: 'Chủ Nhật',
    Mon: 'Thứ Hai',
    Tue: 'Thứ Ba',
    Wed: 'Thứ Tư',
    Thu: 'Thứ Năm',
    Fri: 'Thứ Sáu',
    Sat: 'Thứ Bảy',
  };
  const weekday = weekdayMap[weekdayEn] ?? VN_WEEKDAYS[date.getDay()];
  const day = get('day');
  const month = get('month');
  const year = get('year');
  const hour = get('hour');
  const minute = get('minute');

  return `${weekday}, ngày ${day}/${month}/${year}, ${hour}:${minute} (Asia/Ho_Chi_Minh)`;
}

function nowContextBlock(): string {
  return `[Thời gian hiện tại: ${formatVietnamNow()}]\nDùng mốc thời gian này khi trả lời câu hỏi về ngày/giờ hôm nay.`;
}

/** JSON `debug_info` — khớp vmedia Moon chat. */
function chatDebugInfoJson(cfg: GommoChatConfig): string {
  try {
    const ua = navigator.userAgent;
    const lang = navigator.language || 'vi';
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh';
    let browserVersion = '';
    const chrome = ua.match(/Chrome\/([\d.]+)/);
    if (chrome) browserVersion = chrome[1];

    return JSON.stringify({
      device_id: cfg.deviceId,
      device_name: cfg.deviceName,
      device_type: 'desktop',
      platform: navigator.platform || 'Win32',
      browser_name: 'Chrome',
      browser_version: browserVersion,
      os_name: navigator.platform?.includes('Win') ? 'Windows' : navigator.platform || 'Windows',
      os_version: '10.0',
      app_mode: 'browser',
      is_pwa: false,
      user_agent: ua,
      language: lang.split('-')[0] || 'vi',
      timezone: tz,
      screen: {
        width: window.screen.width,
        height: window.screen.height,
        pixel_ratio: window.devicePixelRatio,
        color_depth: window.screen.colorDepth,
      },
    });
  } catch {
    return '{}';
  }
}

function resolveAgentSystemCustomPrompt(cfg: GommoChatConfig): string {
  const systemPrompt = resolveChatSystemPrompt(cfg);
  return [systemPrompt, nowContextBlock()].filter(Boolean).join('\n\n');
}

function resolveChatApiMode(cfg: GommoChatConfig, opts: AskOptions): GommoChatApiMode {
  if (cfg.chatApiMode) return cfg.chatApiMode;
  if (opts.workflowSnapshot || (opts.attachments?.length ?? 0) > 0) return 'stream';
  return 'agent';
}

function modelRouteKey(server: string, model: string): string {
  return `${server}:${model}`;
}

const syncedAgentModels = new Map<string, string>();

interface ChatCredentials {
  bearerToken: string;
  accessTokenForForm: string;
  platformToken: string;
}

function applyChatAuthFields(
  form: URLSearchParams,
  creds: ChatCredentials,
  domain: string,
): void {
  form.set('domain', domain);
  if (creds.accessTokenForForm) {
    form.set('access_token', creds.accessTokenForForm);
  }
}

/** Đồng bộ model picker lên phiên Moon (vmedia không gửi server/model trong action=chat). */
export async function syncAgentChatModel(opts: {
  sessionId: string;
  server: string;
  model: string;
  agentId?: string;
  signal?: AbortSignal;
}): Promise<void> {
  const auth = loadAuth();
  if (!auth) return;

  const cfg = GOMMO_CHAT_CONFIG;
  const creds = resolveChatCredentials(auth);
  const domain = auth.domain || DEFAULT_DOMAIN;
  const agentId = opts.agentId?.trim() || cfg.agentId || MOON_CHAT_AGENT_ID;
  const route = modelRouteKey(opts.server, opts.model);
  if (syncedAgentModels.get(opts.sessionId) === route) return;

  const form = new URLSearchParams();
  form.set('action', 'set_model');
  form.set('chat_id', opts.sessionId);
  form.set('agent_id', agentId);
  form.set('server', opts.server);
  form.set('model', opts.model);
  form.set('device_id', cfg.deviceId);
  form.set('device_name', cfg.deviceName);
  applyChatAuthFields(form, creds, domain);

  try {
    const res = await fetch(`${cfg.baseUrl}/chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.bearerToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
      signal: opts.signal,
    });
    if (!res.ok) return;
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const j = (await res.json()) as { error?: number };
      if (j.error) return;
    }
    syncedAgentModels.set(opts.sessionId, route);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    console.warn('[gommoChat] set_model failed (bỏ qua):', err);
  }
}

function extractJsonChatContent(json: Record<string, unknown>): string | null {
  const choices = json.choices as { delta?: { content?: string | null }; message?: { content?: string | null } }[] | undefined;
  const fromDelta = choices?.[0]?.delta?.content;
  if (typeof fromDelta === 'string' && fromDelta) return fromDelta;
  const fromMessage = choices?.[0]?.message?.content;
  if (typeof fromMessage === 'string' && fromMessage) return fromMessage;

  for (const key of ['content', 'text', 'message', 'reply', 'response'] as const) {
    const value = json[key];
    if (typeof value === 'string' && value.trim()) return value;
  }

  const data = json.data;
  if (data && typeof data === 'object') {
    const nested = extractJsonChatContent(data as Record<string, unknown>);
    if (nested) return nested;
  }
  return null;
}

async function readChatStreamBody(
  body: ReadableStream<Uint8Array>,
  onDelta: ((chunk: string) => void) | undefined,
  signal?: AbortSignal,
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let rawReply = '';
  let sanitizedEmitted = '';

  const emitStreamContent = (chunk: string) => {
    rawReply += chunk;
    const sanitized = sanitizeChatStreamContent(rawReply, true);
    const delta = sanitized.slice(sanitizedEmitted.length);
    sanitizedEmitted = sanitized;
    if (delta) onDelta?.(delta);
  };

  const consumeLine = (line: string): boolean => {
    const trimmed = line.trim();
    if (!trimmed) return false;

    if (trimmed.startsWith('data:')) {
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') return true;
      try {
        const json = JSON.parse(payload) as Record<string, unknown>;
        const content = extractJsonChatContent(json);
        if (content) emitStreamContent(content);
      } catch {
        // Bỏ qua dòng không parse được.
      }
      return false;
    }

    if (trimmed.startsWith('{')) {
      try {
        const json = JSON.parse(trimmed) as Record<string, unknown>;
        const content = extractJsonChatContent(json);
        if (content) emitStreamContent(content);
      } catch {
        // Bỏ qua.
      }
    }
    return false;
  };

  let done = false;
  while (!done) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const { done: streamDone, value } = await reader.read();
    if (streamDone) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (consumeLine(line)) {
        done = true;
        break;
      }
    }
  }
  if (!done && buffer.trim()) consumeLine(buffer);

  return sanitizeChatStreamContent(rawReply, false);
}

async function postChatAndReadReply(
  cfg: GommoChatConfig,
  creds: ChatCredentials,
  form: URLSearchParams,
  onDelta: ((chunk: string) => void) | undefined,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(`${cfg.baseUrl}/chat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${creds.bearerToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
    signal,
  });

  if (!res.ok) {
    throw new Error(`Chat lỗi HTTP ${res.status}`);
  }

  const contentType = res.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const j = (await res.json()) as Record<string, unknown> & { error?: number; message?: string };
    if (j.error) {
      throw new Error(`${j.message ?? 'Yêu cầu chat bị từ chối'} (error ${j.error})`);
    }
    const text = extractJsonChatContent(j);
    if (text) {
      onDelta?.(text);
      return sanitizeChatStreamContent(text, false);
    }
    throw new Error('Chat không trả về nội dung.');
  }

  if (!res.body) {
    throw new Error('Chat không trả về luồng dữ liệu.');
  }

  return readChatStreamBody(res.body, onDelta, signal);
}

function buildAgentChatForm(
  cfg: GommoChatConfig,
  creds: ChatCredentials,
  domain: string,
  args: {
    sessionId: string;
    query: string;
    systemCustomPrompt: string;
    messagesJson: string;
  },
): URLSearchParams {
  const form = new URLSearchParams();
  form.set('action', 'chat');
  applyChatAuthFields(form, creds, domain);
  form.set('agent_id', cfg.agentId);
  form.set('query', args.query);
  form.set('chat_id', args.sessionId);
  form.set('messages', args.messagesJson);
  form.set('source', cfg.chatSource ?? 'vmedia');
  form.set('system_custom_prompt', args.systemCustomPrompt);
  form.set('debug_info', chatDebugInfoJson(cfg));
  form.set('device_id', cfg.deviceId);
  form.set('device_name', cfg.deviceName);
  return form;
}

function buildStreamChatForm(
  cfg: GommoChatConfig,
  creds: ChatCredentials,
  domain: string,
  projectId: string,
  args: {
    sessionId: string;
    userMessageId: string;
    assistantMessageId: string;
    messagesJson: string;
  },
): URLSearchParams {
  const form = new URLSearchParams();
  form.set('action', 'stream');
  applyChatAuthFields(form, creds, domain);
  form.set('server', cfg.server);
  form.set('model', cfg.model);
  form.set('mode', cfg.model);
  form.set('body_type', 'chat_completions');
  form.set('agent_id', cfg.agentId);
  form.set('session_id', args.sessionId);
  form.set('project_id', projectId);
  form.set('user_message_id', args.userMessageId);
  form.set('assistant_message_id', args.assistantMessageId);
  form.set('messages', args.messagesJson);
  form.set('device_id', cfg.deviceId);
  form.set('device_name', cfg.deviceName);
  return form;
}

const TOOL_CALL_BLOCK_RE = /<\|tool_calls_begin\|>[\s\S]*?<\|tool_calls_end\|>/g;
const TOOL_CALL_PARTIAL_RE = /<\|tool_calls_begin\|>[\s\S]*$/;
const TOOL_CALL_MARKER_RE = /<\|tool_call[^|]*\|>/g;
const TOOL_SEP_RE = /<\|tool_sep\|>/g;

/** Gỡ markup tool call agent (web_search…) khỏi nội dung stream — client chưa execute tool. */
export function sanitizeChatStreamContent(raw: string, streaming = false): string {
  let out = raw.replace(TOOL_CALL_BLOCK_RE, '');
  if (streaming) out = out.replace(TOOL_CALL_PARTIAL_RE, '');
  out = out.replace(TOOL_CALL_MARKER_RE, '').replace(TOOL_SEP_RE, '');
  return out;
}

/** Nội dung hiển thị cuối cùng; fallback thân thiện khi model chỉ gọi tool. */
export function resolveChatAssistantContent(raw: string): string {
  const cleaned = stripMoonVmediaBranding(sanitizeChatStreamContent(raw, false)).trim();
  if (cleaned) return cleaned;
  if (TOOL_CALL_PARTIAL_RE.test(raw) || raw.includes('<|tool_calls_begin|>')) {
    return (
      'Model agent đang cố gọi tool (tra cứu web…) nhưng chat chưa hỗ trợ. ' +
      'Hãy đổi sang GPT-5.5 Cheap hoặc GLM-5.2 VIP, rồi hỏi lại.'
    );
  }
  return '(Không có nội dung trả về.)';
}

/** API 1 & 3 — lưu tin nhắn (best-effort, không chặn câu trả lời). */
function saveMessage(
  cfg: GommoChatConfig,
  platformToken: string,
  domain: string,
  args: {
    messageId: string;
    sessionId: string;
    role: 'user' | 'model';
    text: string;
    attachments?: ChatAttachment[];
    metadata: Record<string, unknown>;
  },
  signal?: AbortSignal,
): void {
  void (async () => {
    try {
      const form = new URLSearchParams();
      form.set('action', 'save_message');
      form.set('domain', domain);
      form.set('message_id', args.messageId);
      form.set('session_id', args.sessionId);
      form.set('role', args.role);
      form.set('text', args.text);
      form.set('attachments', JSON.stringify(args.attachments?.length ? args.attachments : []));
      form.set('timestamp', String(Date.now()));
      form.set('metadata', JSON.stringify(args.metadata));
      form.set('device_id', cfg.deviceId);
      form.set('device_name', cfg.deviceName);
      await fetch(`${cfg.baseUrl}/ai-chat-sessions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${platformToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
        signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.warn('[gommoChat] save_message failed (bỏ qua):', err);
    }
  })();
}

/**
 * Gửi 1 lượt chat tới Gommo, stream từng chữ qua onDelta, trả về câu trả lời đầy đủ.
 * Ném Error nếu chưa đăng nhập, lỗi mạng, hoặc lỗi mềm (token/tham số sai).
 */
export async function askGommo(userText: string, opts: AskOptions): Promise<string> {
  const auth = loadAuth();
  if (!auth) {
    throw new Error('Chưa đăng nhập — không thể chat.');
  }
  const creds = resolveChatCredentials(auth);
  const cfg: GommoChatConfig = { ...GOMMO_CHAT_CONFIG, ...opts.config };
  const platformToken = creds.platformToken;
  const domain = auth.domain || DEFAULT_DOMAIN;
  const projectId = cfg.projectId?.trim() || auth.projectId?.trim() || DEFAULT_PROJECT_ID;
  const apiMode = resolveChatApiMode(cfg, opts);

  const userMessageId = uuid();
  const assistantMessageId = uuid();
  const turnAttachments = opts.attachments?.length ? opts.attachments : [];

  const systemPrompt = resolveChatSystemPrompt(cfg);
  const snapshotBlock = opts.workflowSnapshot
    ? `\n\n[Canvas hiện tại]\n${opts.workflowSnapshot}`
    : '';
  const sendText =
    (opts.firstTurn && systemPrompt ? `${systemPrompt}\n\n` : '') +
    `${nowContextBlock()}\n\n` +
    userText +
    snapshotBlock;

  const fullHistory: ChatTurn[] = [
    ...opts.history,
    { role: 'user', text: sendText, attachments: turnAttachments },
  ];

  const ac = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ac.abort();
  }, cfg.timeoutMs);
  const onExternalAbort = () => ac.abort();
  opts.signal?.addEventListener('abort', onExternalAbort);

  try {
    if (cfg.persistHistory && platformToken) {
      saveMessage(cfg, platformToken, domain, {
        messageId: userMessageId,
        sessionId: opts.sessionId,
        role: 'user',
        text: userText,
        attachments: turnAttachments,
        metadata: { version: 1 },
      }, ac.signal);
    }

    let reply = '';

    if (apiMode === 'agent') {
      await syncAgentChatModel({
        sessionId: opts.sessionId,
        server: cfg.server,
        model: cfg.model,
        agentId: cfg.agentId,
        signal: ac.signal,
      });

      const agentHistory: ChatTurn[] = [
        ...opts.history,
        { role: 'user', text: userText.trim(), attachments: turnAttachments },
      ];

      const form = buildAgentChatForm(cfg, creds, domain, {
        sessionId: opts.sessionId,
        query: userText.trim(),
        systemCustomPrompt: resolveAgentSystemCustomPrompt(cfg),
        messagesJson: serializeMessages(agentHistory),
      });
      reply = await postChatAndReadReply(cfg, creds, form, opts.onDelta, ac.signal);
    } else {
      const form = buildStreamChatForm(cfg, creds, domain, projectId, {
        sessionId: opts.sessionId,
        userMessageId,
        assistantMessageId,
        messagesJson: serializeMessages(fullHistory),
      });
      reply = await postChatAndReadReply(cfg, creds, form, opts.onDelta, ac.signal);
    }

    if (cfg.persistHistory && platformToken) {
      saveMessage(cfg, platformToken, domain, {
        messageId: assistantMessageId,
        sessionId: opts.sessionId,
        role: 'model',
        text: reply,
        metadata: {
          version: 1,
          agentId: cfg.agentId,
          model: cfg.model,
          server: cfg.server,
          chatApiMode: apiMode,
        },
      });
    }

    return reply;
  } catch (err) {
    if (
      timedOut &&
      ((err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && err.name === 'AbortError'))
    ) {
      throw new Error('Chat quá thời gian chờ. Vui lòng thử lại.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onExternalAbort);
  }
}
