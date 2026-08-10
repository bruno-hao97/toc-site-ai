import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { askGommo, isGommoChatConfigured, resolveChatAssistantContent, syncAgentChatModel, type ChatAttachment, type ChatTurn } from '../services/gommoChat';
import {
  loadQuickChatModelId,
  resolveChatAiModel,
  saveQuickChatModelId,
} from '../services/chatAiModels';
import { resolveQuickChatContext } from '../services/quickChatContext';
import type { ChatPill } from '../services/chatPageData';
import {
  deleteChatSession,
  getChatSession,
  listChatSessions,
  onChatSessionsUpdated,
  sessionTitleFromMessages,
  upsertChatSession,
  type ChatMessage,
  type ChatSessionSummary,
} from '../services/chatSessionsLocal';
import { getJobClient } from '../services/platformJobClient';
import { useDisplayCredits } from '../hooks/useDisplayCredits';
import ChatAiModelPickerModal from '../components/ChatAiModelPickerModal';
import ChatSidebar from '../components/chat/ChatSidebar';
import ChatTopBar from '../components/chat/ChatTopBar';
import ChatHero from '../components/chat/ChatHero';
import ChatSuggestions from '../components/chat/ChatSuggestions';
import ChatMarketplaceStrip from '../components/chat/ChatMarketplaceStrip';
import ChatCompose from '../components/chat/ChatCompose';
import ChatMessageList from '../components/chat/ChatMessageList';
import { MOONIX_TEMPLATE_PROMPT_KEY } from '../services/moonixContentApi';
import { buildReplyPromptText, buildReplyRef, messagePromptText } from '../services/chatReply';
import type { ChatMessageReplyRef } from '../services/chatSessionsLocal';

const chatCtx = resolveQuickChatContext('/chat');

function newId(): string {
  return `cp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function newSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return newId();
}

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === 'AbortError') ||
    (err instanceof Error && err.name === 'AbortError')
  );
}

type PendingAttachment = {
  file: File;
  previewUrl: string;
  name: string;
};

function turnFromMessage(m: ChatMessage): ChatTurn {
  const attachments: ChatAttachment[] =
    m.imageUrl && /^https?:\/\//i.test(m.imageUrl)
      ? [{ type: 'image', url: m.imageUrl }]
      : [];
  return {
    role: m.role === 'assistant' ? 'model' : 'user',
    text: messagePromptText(m),
    attachments,
  };
}

export default function ChatPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { credits } = useDisplayCredits({ refreshOnMount: true });

  const [view, setView] = useState<'landing' | 'thread'>('landing');
  const [sessionId, setSessionId] = useState(() => newSessionId());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const [thinking, setThinking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [modelId, setModelId] = useState(() => loadQuickChatModelId());
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [sessions, setSessions] = useState<ChatSessionSummary[]>(() => listChatSessions());
  const [search, setSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sendGenRef = useRef(0);
  const userStoppedRef = useRef(false);
  const mountedRef = useRef(true);
  const selectedModel = resolveChatAiModel(modelId);

  const refreshSessions = useCallback(() => {
    setSessions(listChatSessions());
  }, []);

  useEffect(() => onChatSessionsUpdated(refreshSessions), [refreshSessions]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('create') !== 'mini_app') return;
    try {
      const prompt = sessionStorage.getItem(MOONIX_TEMPLATE_PROMPT_KEY);
      if (prompt) {
        setInput(prompt);
        sessionStorage.removeItem(MOONIX_TEMPLATE_PROMPT_KEY);
      }
    } catch {
      // private mode / quota
    }
    navigate('/chat', { replace: true });
  }, [location.search, navigate]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const persistSession = useCallback((sid: string, msgs: ChatMessage[]) => {
    if (msgs.length === 0) return;
    upsertChatSession({
      sessionId: sid,
      title: sessionTitleFromMessages(msgs),
      updatedAt: Date.now(),
      messages: msgs,
    });
  }, []);

  const clearAttachment = useCallback(() => {
    setAttachment((prev) => {
      if (prev?.previewUrl.startsWith('blob:')) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  }, []);

  const clearReply = useCallback(() => {
    setReplyTo(null);
  }, []);

  const newChat = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setThinking(false);
    setUploading(false);
    setView('landing');
    setMessages([]);
    setInput('');
    clearReply();
    clearAttachment();
    setSessionId(newSessionId());
    setSidebarOpen(false);
  }, [clearAttachment, clearReply]);

  const selectSession = useCallback(
    (sid: string) => {
      const data = getChatSession(sid);
      if (!data) return;
      abortRef.current?.abort();
      abortRef.current = null;
      setThinking(false);
      setUploading(false);
      setSessionId(data.sessionId);
      setMessages(data.messages);
      setInput('');
      clearReply();
      clearAttachment();
      setView(data.messages.length > 0 ? 'thread' : 'landing');
    },
    [clearAttachment, clearReply],
  );

  const onDeleteSession = useCallback(
    (sid: string) => {
      if (!window.confirm('Xóa đoạn chat này?')) return;
      deleteChatSession(sid);
      if (sid === sessionId) {
        abortRef.current?.abort();
        abortRef.current = null;
        setThinking(false);
        setUploading(false);
        setView('landing');
        setMessages([]);
        setInput('');
        clearReply();
        clearAttachment();
        setSessionId(newSessionId());
      }
    },
    [sessionId, clearAttachment, clearReply],
  );

  const onPickFile = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      window.alert('Chỉ hỗ trợ đính kèm ảnh.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      window.alert('Ảnh tối đa 15MB.');
      return;
    }
    setAttachment((prev) => {
      if (prev?.previewUrl.startsWith('blob:')) URL.revokeObjectURL(prev.previewUrl);
      return { file, previewUrl: URL.createObjectURL(file), name: file.name };
    });
  };

  const patchAssistant = (id: string, patch: Partial<ChatMessage>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const onReply = useCallback((message: ChatMessage) => {
    setReplyTo(message);
  }, []);

  const runAssistantTurn = useCallback(
    async (params: {
      gen: number;
      priorMessages: ChatMessage[];
      userMsg: ChatMessage;
      assistantId: string;
      history: ChatTurn[];
      firstTurn: boolean;
      promptText: string;
      turnAttachments: ChatAttachment[];
      startedAt: number;
    }) => {
      const {
        gen,
        priorMessages,
        userMsg,
        assistantId,
        history,
        firstTurn,
        promptText,
        turnAttachments,
        startedAt,
      } = params;
      const chatModel = resolveChatAiModel(modelId);
      const ac = new AbortController();
      abortRef.current = ac;
      let acc = '';

      try {
        await askGommo(promptText || 'Mô tả ảnh này giúp tôi.', {
          history,
          firstTurn,
          sessionId,
          attachments: turnAttachments,
          signal: ac.signal,
          config: {
            model: chatModel.model,
            server: chatModel.server,
            systemPrompt: chatCtx.systemPrompt,
          },
          onDelta: (chunk) => {
            acc += chunk;
            patchAssistant(assistantId, { content: resolveChatAssistantContent(acc) });
          },
        });

        const assistantContent = resolveChatAssistantContent(acc);
        if (sendGenRef.current !== gen || !mountedRef.current) return;
        const elapsedSec = Math.max(1, Math.ceil((Date.now() - startedAt) / 1000));
        const finalMessages: ChatMessage[] = [
          ...priorMessages,
          userMsg,
          {
            id: assistantId,
            role: 'assistant',
            content: assistantContent,
            meta: { elapsedSec },
          },
        ];
        setMessages(finalMessages);
        persistSession(sessionId, finalMessages);
      } catch (err) {
        if (sendGenRef.current !== gen || !mountedRef.current) return;
        const elapsedSec = Math.max(1, Math.ceil((Date.now() - startedAt) / 1000));
        if (isAbortError(err)) {
          const stoppedMsg = userStoppedRef.current
            ? '(Đã dừng.)'
            : '⚠️ Kết nối bị gián đoạn. Vui lòng gửi lại tin nhắn.';
          const partial = acc.trim();
          setMessages((prev) => {
            const streamed = prev.find((m) => m.id === assistantId)?.content.trim() || partial;
            const finalMessages = prev.map((m) => {
              if (m.id === userMsg.id) return userMsg;
              if (m.id === assistantId) {
                return {
                  ...m,
                  content: streamed || stoppedMsg,
                  meta: { elapsedSec },
                };
              }
              return m;
            });
            if (streamed) persistSession(sessionId, finalMessages);
            return finalMessages;
          });
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          const errContent = `⚠️ Lỗi: ${msg}`;
          const finalMessages: ChatMessage[] = [
            ...priorMessages,
            userMsg,
            { id: assistantId, role: 'assistant', content: errContent, meta: { elapsedSec } },
          ];
          setMessages(finalMessages);
          persistSession(sessionId, finalMessages);
        }
      } finally {
        if (sendGenRef.current !== gen) return;
        if (abortRef.current === ac) abortRef.current = null;
        if (mountedRef.current) {
          setUploading(false);
          setThinking(false);
        }
      }
    },
    [modelId, persistSession, sessionId],
  );

  const onSelectModel = (id: string) => {
    setModelId(id);
    saveQuickChatModelId(id);
    const model = resolveChatAiModel(id);
    void syncAgentChatModel({
      sessionId,
      server: model.server,
      model: model.model,
    });
  };

  const onPill = (pill: ChatPill) => {
    if (pill.action.type === 'navigate') {
      navigate(pill.action.href);
      return;
    }
    if (pill.action.type === 'model') {
      onSelectModel(pill.action.modelId);
      return;
    }
    setInput(pill.action.text);
  };

  const stop = useCallback(() => {
    userStoppedRef.current = true;
    abortRef.current?.abort();
  }, []);

  const regenerateAssistant = useCallback(
    async (assistantMsg: ChatMessage) => {
      if (thinking || uploading) return;
      const idx = messages.findIndex((m) => m.id === assistantMsg.id);
      if (idx < 1) return;
      const userMsg = messages[idx - 1];
      if (userMsg?.role !== 'user') return;

      if (!isGommoChatConfigured()) {
        window.alert('Bạn cần đăng nhập để dùng Chat AI.');
        return;
      }

      abortRef.current?.abort();
      userStoppedRef.current = false;
      const gen = ++sendGenRef.current;
      const priorMessages = messages.slice(0, idx - 1);
      const assistantId = newId();
      const history: ChatTurn[] = priorMessages.map(turnFromMessage);
      const turnAttachments: ChatAttachment[] =
        userMsg.imageUrl && /^https?:\/\//i.test(userMsg.imageUrl)
          ? [{ type: 'image', url: userMsg.imageUrl }]
          : [];

      setMessages([...priorMessages, userMsg, { id: assistantId, role: 'assistant', content: '' }]);
      setView('thread');
      setThinking(true);

      await runAssistantTurn({
        gen,
        priorMessages,
        userMsg,
        assistantId,
        history,
        firstTurn: priorMessages.length === 0,
        promptText: userMsg.content,
        turnAttachments,
        startedAt: Date.now(),
      });
    },
    [messages, runAssistantTurn, thinking, uploading],
  );

  const send = async (overrideText?: string) => {
    const displayText = (overrideText ?? input).trim();
    const pending = attachment;
    const activeReply = replyTo;
    if ((!displayText && !pending) || thinking || uploading) return;

    if (!isGommoChatConfigured()) {
      window.alert('Bạn cần đăng nhập để dùng Chat AI.');
      return;
    }

    abortRef.current?.abort();
    userStoppedRef.current = false;
    const gen = ++sendGenRef.current;

    let replyRef: ChatMessageReplyRef | undefined;
    let promptText = displayText || 'Mô tả ảnh này giúp tôi.';

    if (activeReply) {
      replyRef = buildReplyRef(activeReply, selectedModel.name, modelId);
      promptText = buildReplyPromptText(displayText, replyRef);
    }

    setInput('');
    setReplyTo(null);

    const assistantId = newId();
    const userMsgId = newId();
    const priorMessages = messages;
    const history: ChatTurn[] = priorMessages.map(turnFromMessage);
    const firstTurn = priorMessages.length === 0;

    // Preview local trước; sau upload sẽ thay bằng CDN URL.
    const previewUrl = pending?.previewUrl;
    let imageUrl = previewUrl;
    const nextMessages: ChatMessage[] = [
      ...priorMessages,
      {
        id: userMsgId,
        role: 'user',
        content: displayText,
        imageUrl: previewUrl,
        replyTo: replyRef,
      },
      { id: assistantId, role: 'assistant', content: '' },
    ];
    setMessages(nextMessages);
    setAttachment(null);
    setView('thread');
    setThinking(true);

    const startedAt = Date.now();
    let turnAttachments: ChatAttachment[] = [];

    try {
      if (pending) {
        setUploading(true);
        try {
          const { url } = await getJobClient().uploadImage(pending.file, pending.name);
          imageUrl = url;
          turnAttachments = [
            {
              type: 'image',
              url,
              name: pending.name,
              mime_type: pending.file.type || 'image/jpeg',
            },
          ];
          setMessages((prev) =>
            prev.map((m) => (m.id === userMsgId ? { ...m, imageUrl: url } : m)),
          );
          if (pending.previewUrl.startsWith('blob:')) URL.revokeObjectURL(pending.previewUrl);
        } finally {
          setUploading(false);
        }
      }

      const userMsg: ChatMessage = {
        id: userMsgId,
        role: 'user',
        content: displayText,
        imageUrl,
        replyTo: replyRef,
      };

      await runAssistantTurn({
        gen,
        priorMessages,
        userMsg,
        assistantId,
        history,
        firstTurn,
        promptText,
        turnAttachments,
        startedAt,
      });
    } catch {
      if (sendGenRef.current !== gen || !mountedRef.current) return;
      setUploading(false);
      setThinking(false);
    }
  };

  return (
    <div className="chat-page">
      <ChatSidebar
        sessions={sessions}
        activeSessionId={view === 'thread' ? sessionId : null}
        search={search}
        credits={credits}
        open={sidebarOpen}
        onSearchChange={setSearch}
        onNewChat={newChat}
        onSelectSession={selectSession}
        onDeleteSession={onDeleteSession}
        onClose={() => setSidebarOpen(false)}
      />

      <div className={`chat-main${view === 'landing' ? ' chat-main--landing' : ''}`}>
        <ChatTopBar
          model={selectedModel}
          onOpenModelPicker={() => setModelPickerOpen(true)}
          onNewChat={newChat}
          onOpenSidebar={() => setSidebarOpen(true)}
        />

        {view === 'landing' ? (
          <div className="chat-landing">
            <div className="chat-landing-inner">
              <ChatHero model={selectedModel} />
              <ChatCompose
                input={input}
                thinking={thinking}
                uploading={uploading}
                attachment={attachment ? { url: attachment.previewUrl, name: attachment.name } : null}
                replyTo={replyTo}
                agentName={selectedModel.name}
                agentId={modelId}
                onInputChange={setInput}
                onSend={() => void send()}
                onStop={stop}
                onPickFile={onPickFile}
                onClearAttachment={clearAttachment}
                onClearReply={clearReply}
                onPill={onPill}
                fileRef={fileRef}
              />
              <ChatSuggestions onSuggestion={(text) => void send(text)} />
              <ChatMarketplaceStrip />
            </div>
          </div>
        ) : (
          <div className="chat-thread">
            <ChatMessageList
              messages={messages}
              thinking={thinking || uploading}
              listRef={listRef}
              onReply={onReply}
              onRegenerate={(msg) => void regenerateAssistant(msg)}
            />
            <div className="chat-thread-compose-wrap">
              <ChatCompose
                compact
                input={input}
                thinking={thinking}
                uploading={uploading}
                attachment={attachment ? { url: attachment.previewUrl, name: attachment.name } : null}
                replyTo={replyTo}
                agentName={selectedModel.name}
                agentId={modelId}
                onInputChange={setInput}
                onSend={() => void send()}
                onStop={stop}
                onPickFile={onPickFile}
                onClearAttachment={clearAttachment}
                onClearReply={clearReply}
                onPill={onPill}
                fileRef={fileRef}
              />
            </div>
          </div>
        )}
      </div>

      <ChatAiModelPickerModal
        open={modelPickerOpen}
        selectedId={modelId}
        onSelect={onSelectModel}
        onClose={() => setModelPickerOpen(false)}
      />
    </div>
  );
}
