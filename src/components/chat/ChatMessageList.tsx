import type { RefObject } from 'react';
import { Bot } from 'lucide-react';
import type { ChatMessage } from '../../services/chatSessionsLocal';
import { stripChatDisplayText } from '../../services/stripChatMarkdown';

interface Props {
  messages: ChatMessage[];
  thinking: boolean;
  listRef: RefObject<HTMLDivElement | null>;
}

export default function ChatMessageList({ messages, thinking, listRef }: Props) {
  return (
    <div className="chat-thread-messages" ref={listRef}>
      {messages.map((m) => (
        <div key={m.id} className={`chat-thread-msg chat-thread-msg--${m.role}`}>
          {m.role === 'assistant' && (
            <span className="chat-thread-msg-avatar">
              <Bot size={14} />
            </span>
          )}
          <div className="chat-thread-bubble">
            {m.imageUrl && (
              <img className="chat-thread-bubble-img" src={m.imageUrl} alt="đính kèm" />
            )}
            {m.role === 'assistant' && !m.content ? (
              <span className="chat-thread-typing">Đang trả lời…</span>
            ) : (
              stripChatDisplayText(m.content).split('\n').map((line, i, arr) => (
                <span key={i}>
                  {line}
                  {i < arr.length - 1 && <br />}
                </span>
              ))
            )}
          </div>
        </div>
      ))}
      {thinking && messages[messages.length - 1]?.role !== 'assistant' && (
        <div className="chat-thread-msg chat-thread-msg--assistant">
          <span className="chat-thread-msg-avatar">
            <Bot size={14} />
          </span>
          <div className="chat-thread-bubble">
            <span className="chat-thread-typing">Đang trả lời…</span>
          </div>
        </div>
      )}
    </div>
  );
}
