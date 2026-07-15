import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Bot, Send } from 'lucide-react';
import type { ChatTurn } from '../services/gommoChat';
import type { ComposerShot } from '../services/composerShots';
import {
  VIDEO_AGENT_WELCOME,
  askVideoAgent,
  canUseVideoAgentChat,
  parseVideoAgentScript,
  type VideoAgentMessage,
} from '../services/videoAgentChat';

function newId(): string {
  return `va_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function newSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return newId();
}

function renderMarkdownLite(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br />');
}

interface ComposerVideoAgentChatProps {
  maxShots?: number;
  disabled?: boolean;
  scriptCount?: number;
  onScriptParsed: (data: { prompt?: string; shots?: ComposerShot[] }) => void;
}

export default function ComposerVideoAgentChat({
  maxShots = 6,
  disabled = false,
  scriptCount = 0,
  onScriptParsed,
}: ComposerVideoAgentChatProps) {
  const [messages, setMessages] = useState<VideoAgentMessage[]>([
    { id: 'welcome', role: 'assistant', content: VIDEO_AGENT_WELCOME },
  ]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [sessionId, setSessionId] = useState<string>(() => newSessionId());
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking]);

  const patchAssistant = (id: string, content: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content } : m)));
  };

  const resetChat = () => {
    setMessages([{ id: 'welcome', role: 'assistant', content: VIDEO_AGENT_WELCOME }]);
    setInput('');
    setSessionId(newSessionId());
  };

  const send = async () => {
    const text = input.trim();
    if (!text || thinking || disabled) return;

    if (!canUseVideoAgentChat()) {
      window.alert('Đăng nhập (Gommo token hoặc tài khoản app) để dùng Video Agent.');
      return;
    }

    setInput('');
    const userMsg: VideoAgentMessage = { id: newId(), role: 'user', content: text };
    const assistantId = newId();
    const history: ChatTurn[] = messages
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        text: m.content,
      }));
    const firstTurn = history.length === 0;

    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '' }]);
    setThinking(true);

    let acc = '';
    try {
      await askVideoAgent(text, history, {
        sessionId,
        firstTurn,
        onDelta: (chunk) => {
          acc += chunk;
          patchAssistant(assistantId, acc);
        },
      });
      if (!acc.trim()) {
        patchAssistant(assistantId, '(Không có nội dung trả về.)');
      } else {
        const parsed = parseVideoAgentScript(acc, maxShots);
        if (parsed.shots?.length || parsed.prompt) {
          onScriptParsed(parsed);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      patchAssistant(assistantId, `⚠️ Lỗi: ${msg}`);
    } finally {
      setThinking(false);
      inputRef.current?.focus();
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div className="composer-video-agent">
      <div className="composer-video-agent-head">
        <span className="composer-video-agent-avatar">
          <Bot size={18} />
        </span>
        <div className="composer-video-agent-meta">
          <strong>Video Agent</strong>
          <small>Gemini · soạn kịch bản video</small>
        </div>
        {scriptCount > 0 && (
          <span className="composer-script-badge">{scriptCount} Kịch bản</span>
        )}
        <button type="button" className="composer-video-agent-reset" onClick={resetChat}>
          Phiên mới
        </button>
      </div>

      <div className="composer-video-agent-messages" ref={listRef}>
        {messages.map((m) => (
          <div
            key={m.id}
            className={`composer-video-agent-msg composer-video-agent-msg--${m.role}`}
          >
            {m.role === 'assistant' && (
              <span className="composer-video-agent-msg-avatar">
                <Bot size={14} />
              </span>
            )}
            <div
              className="composer-video-agent-bubble"
              dangerouslySetInnerHTML={{ __html: renderMarkdownLite(m.content) }}
            />
          </div>
        ))}
        {thinking && (
          <div className="composer-video-agent-msg composer-video-agent-msg--assistant">
            <span className="composer-video-agent-msg-avatar">
              <Bot size={14} />
            </span>
            <div className="composer-video-agent-bubble composer-video-agent-typing">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
      </div>

      <div className="composer-video-agent-compose">
        <textarea
          ref={inputRef}
          rows={2}
          placeholder="Message Video Agent…"
          value={input}
          disabled={disabled || thinking}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          className="composer-video-agent-send"
          aria-label="Gửi"
          disabled={disabled || thinking || !input.trim()}
          onClick={() => void send()}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
