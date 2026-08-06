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
    text: m.content,
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

  const newChat = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setThinking(false);
    setUploading(false);
    setView('landing');
    setMessages([]);
    setInput('');
    clearAttachment();
    setSessionId(newSessionId());
    setSidebarOpen(false);
  }, [clearAttachment]);

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
      clearAttachment();
      setView(data.messages.length > 0 ? 'thread' : 'landing');
    },
    [clearAttachment],
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
        clearAttachment();
        setSessionId(newSessionId());
      }
    },
    [sessionId, clearAttachment],
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

  const patchAssistant = (id: string, content: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content } : m)));
  };

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

  const send = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    const pending = attachment;
    if ((!text && !pending) || thinking || uploading) return;

    if (!isGommoChatConfigured()) {
      window.alert('Bạn cần đăng nhập để dùng Chat AI.');
      return;
    }

    abortRef.current?.abort();
    userStoppedRef.current = false;
    const gen = ++sendGenRef.current;

    setInput('');

    const assistantId = newId();
    const userMsgId = newId();
    const priorMessages = messages;
    const history: ChatTurn[] = priorMessages.map(turnFromMessage);
    const firstTurn = priorMessages.length === 0;
    const chatModel = resolveChatAiModel(modelId);

    // Preview local trước; sau upload sẽ thay bằng CDN URL.
    const previewUrl = pending?.previewUrl;
    const nextMessages: ChatMessage[] = [
      ...priorMessages,
      {
        id: userMsgId,
        role: 'user',
        content: text,
        imageUrl: previewUrl,
      },
      { id: assistantId, role: 'assistant', content: '' },
    ];
    setMessages(nextMessages);
    setAttachment(null);
    setView('thread');
    setThinking(true);

    const ac = new AbortController();
    abortRef.current = ac;

    let imageUrl = previewUrl;
    let turnAttachments: ChatAttachment[] = [];
    let acc = '';

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

      await askGommo(text || 'Mô tả ảnh này giúp tôi.', {
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
          patchAssistant(assistantId, resolveChatAssistantContent(acc));
        },
      });

      const assistantContent = resolveChatAssistantContent(acc);
      if (sendGenRef.current !== gen || !mountedRef.current) return;
      const finalMessages: ChatMessage[] = [
        ...priorMessages,
        { id: userMsgId, role: 'user', content: text, imageUrl },
        { id: assistantId, role: 'assistant', content: assistantContent },
      ];
      setMessages(finalMessages);
      persistSession(sessionId, finalMessages);
    } catch (err) {
      if (sendGenRef.current !== gen || !mountedRef.current) return;
      if (isAbortError(err)) {
        const stoppedMsg = userStoppedRef.current
          ? '(Đã dừng.)'
          : '⚠️ Kết nối bị gián đoạn. Vui lòng gửi lại tin nhắn.';
        const partial = acc.trim();
        setMessages((prev) => {
          const streamed = prev.find((m) => m.id === assistantId)?.content.trim() || partial;
          const finalMessages = prev.map((m) => {
            if (m.id === userMsgId) return { ...m, imageUrl };
            if (m.id === assistantId) return { ...m, content: streamed || stoppedMsg };
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
          { id: userMsgId, role: 'user', content: text, imageUrl },
          { id: assistantId, role: 'assistant', content: errContent },
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
                onInputChange={setInput}
                onSend={() => void send()}
                onStop={stop}
                onPickFile={onPickFile}
                onClearAttachment={clearAttachment}
                onPill={onPill}
                fileRef={fileRef}
              />
              <ChatSuggestions onSuggestion={(text) => void send(text)} />
              <ChatMarketplaceStrip />
            </div>
          </div>
        ) : (
          <div className="chat-thread">
            <ChatMessageList messages={messages} thinking={thinking || uploading} listRef={listRef} />
            <div className="chat-thread-compose-wrap">
              <ChatCompose
                compact
                input={input}
                thinking={thinking}
                uploading={uploading}
                attachment={attachment ? { url: attachment.previewUrl, name: attachment.name } : null}
                onInputChange={setInput}
                onSend={() => void send()}
                onStop={stop}
                onPickFile={onPickFile}
                onClearAttachment={clearAttachment}
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
