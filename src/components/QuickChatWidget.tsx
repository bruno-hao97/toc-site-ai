import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowUp, Bot, ChevronDown, Paperclip, Plus, X } from 'lucide-react';
import { askGommo, isGommoChatConfigured, resolveChatAssistantContent, syncAgentChatModel, type ChatTurn } from '../services/gommoChat';
import {
  loadQuickChatModelId,
  resolveChatAiModel,
  saveQuickChatModelId,
} from '../services/chatAiModels';
import { resolveQuickChatContext } from '../services/quickChatContext';
import { formatAgentDisplayContent } from '../services/agentDisplayContent';
import { stripChatDisplayText } from '../services/stripChatMarkdown';
import ChatAiModelPickerModal from './ChatAiModelPickerModal';

interface QuickMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
}

function newId(): string {
  return `qc_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function newSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return newId();
}

export default function QuickChatWidget() {
  const location = useLocation();
  const chatCtx = resolveQuickChatContext(location.pathname);

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<QuickMessage[]>([]);
  const [input, setInput] = useState('');
  const [attachment, setAttachment] = useState<{ url: string; name: string } | null>(null);
  const [thinking, setThinking] = useState(false);
  const [sessionId, setSessionId] = useState<string>(() => newSessionId());
  const [modelId, setModelId] = useState(() => loadQuickChatModelId());
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [contextId, setContextId] = useState(chatCtx.id);

  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const selectedModel = resolveChatAiModel(modelId);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking]);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('quick-chat:open', onOpen);
    return () => window.removeEventListener('quick-chat:open', onOpen);
  }, []);

  useEffect(() => {
    document.body.classList.toggle('qc-sidebar-open', open);
    return () => document.body.classList.remove('qc-sidebar-open');
  }, [open]);

  // Đổi tab (Image/Video/…) → session mới + prompt ngữ cảnh mới.
  useEffect(() => {
    if (chatCtx.id === contextId) return;
    setContextId(chatCtx.id);
    setMessages([]);
    setInput('');
    setAttachment(null);
    setSessionId(newSessionId());
  }, [chatCtx.id, contextId]);

  const resetChat = () => {
    setMessages([]);
    setInput('');
    setAttachment(null);
    setSessionId(newSessionId());
  };

  const onPickFile = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      window.alert('Chỉ hỗ trợ đính kèm ảnh.');
      return;
    }
    const url = URL.createObjectURL(file);
    setAttachment({ url, name: file.name });
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

  const displayText = (role: QuickMessage['role'], content: string) => {
    if (role === 'assistant' && chatCtx.id === 'workflow') {
      return formatAgentDisplayContent(content) || content;
    }
    if (role === 'assistant') return stripChatDisplayText(content);
    return content;
  };

  const send = async () => {
    const text = input.trim();
    if ((!text && !attachment) || thinking) return;

    if (!isGommoChatConfigured()) {
      window.alert('Bạn cần đăng nhập để dùng Quick Chat.');
      return;
    }

    setInput('');
    const userMsg: QuickMessage = {
      id: newId(),
      role: 'user',
      content: text,
      imageUrl: attachment?.url,
    };
    const assistantId = newId();
    const history: ChatTurn[] = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      text: m.content,
    }));
    const firstTurn = messages.length === 0;
    const chatModel = resolveChatAiModel(modelId);

    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: 'assistant', content: '' },
    ]);
    setAttachment(null);
    setThinking(true);

    let acc = '';
    try {
      await askGommo(text || 'Mô tả ảnh này giúp tôi.', {
        history,
        firstTurn,
        sessionId,
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
      const finalContent = resolveChatAssistantContent(acc);
      if (finalContent !== acc.trim()) patchAssistant(assistantId, finalContent);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      patchAssistant(assistantId, `⚠️ Lỗi: ${msg}`);
    } finally {
      setThinking(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        className="quick-chat-fab"
        onClick={() => setOpen(true)}
        title={`Quick Chat · ${chatCtx.label}`}
        aria-label="Mở Quick Chat"
      >
        <Bot size={24} />
      </button>
    );
  }

  return (
    <>
      <aside className="quick-chat-panel quick-chat-sidebar" aria-label="Quick Chat">
        <header className="quick-chat-head">
          <div className="quick-chat-head-left">
            <div className="quick-chat-context">
              <button
                type="button"
                className="quick-chat-model-trigger"
                onClick={() => setModelPickerOpen(true)}
                title="Chọn model Chat AI"
                aria-label="Chọn model Chat AI"
              >
                <span>{selectedModel.name}</span>
                <ChevronDown size={14} />
              </button>
              <span className="quick-chat-context-sub">{chatCtx.subtitle}</span>
            </div>
          </div>
          <div className="quick-chat-head-actions">
            <button type="button" onClick={resetChat} title="Chat mới" aria-label="Chat mới">
              <Plus size={16} />
            </button>
            <button type="button" onClick={() => setOpen(false)} title="Đóng" aria-label="Đóng">
              <X size={16} />
            </button>
          </div>
        </header>

        <div className="quick-chat-messages" ref={listRef}>
          {messages.length === 0 && !thinking ? (
            <div className="quick-chat-empty">{chatCtx.emptyHint}</div>
          ) : (
            messages.map((m) => {
              const shown = displayText(m.role, m.content);
              return (
                <div key={m.id} className={`quick-chat-msg quick-chat-msg--${m.role}`}>
                  {m.role === 'assistant' && (
                    <span className="quick-chat-msg-avatar">
                      <Bot size={13} />
                    </span>
                  )}
                  <div className="quick-chat-bubble">
                    {m.imageUrl && (
                      <img className="quick-chat-bubble-img" src={m.imageUrl} alt="đính kèm" />
                    )}
                    {m.role === 'assistant' && !m.content ? (
                      <span className="quick-chat-typing">Đang trả lời…</span>
                    ) : (
                      shown.split('\n').map((line, i, arr) => (
                        <span key={i}>
                          {line}
                          {i < arr.length - 1 && <br />}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {attachment && (
          <div className="quick-chat-attachment">
            <img src={attachment.url} alt={attachment.name} />
            <span className="quick-chat-attachment-name">{attachment.name}</span>
            <button type="button" onClick={() => setAttachment(null)} aria-label="Bỏ ảnh">
              <X size={13} />
            </button>
          </div>
        )}

        <div className="quick-chat-compose">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              onPickFile(e.target.files?.[0] ?? null);
              e.target.value = '';
            }}
          />
          <div className="quick-chat-compose-bar">
            <button
              type="button"
              className="quick-chat-attach-btn"
              onClick={() => fileRef.current?.click()}
              title="Đính kèm ảnh"
              aria-label="Đính kèm ảnh"
            >
              <Paperclip size={16} />
            </button>
            <input
              className="quick-chat-input"
              placeholder={chatCtx.placeholder}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <button
              type="button"
              className="quick-chat-send"
              onClick={() => void send()}
              disabled={thinking || (!input.trim() && !attachment)}
              title="Gửi"
              aria-label="Gửi"
            >
              <ArrowUp size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </aside>

      <ChatAiModelPickerModal
        open={modelPickerOpen}
        selectedId={modelId}
        onSelect={onSelectModel}
        onClose={() => setModelPickerOpen(false)}
      />
    </>
  );
}
