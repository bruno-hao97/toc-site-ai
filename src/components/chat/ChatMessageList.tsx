import type { RefObject } from 'react';
import { Bot } from 'lucide-react';
import type { ChatMessage } from '../../services/chatSessionsLocal';
import { replyMentionLabel } from '../../services/chatReply';
import { stripChatDisplayText } from '../../services/stripChatMarkdown';
import ChatReasoningIndicator from './ChatReasoningIndicator';
import ChatMessageActions from './ChatMessageActions';
import ChatMessageReplyCard from './ChatMessageReplyCard';

interface Props {
  messages: ChatMessage[];
  thinking: boolean;
  listRef: RefObject<HTMLDivElement | null>;
  onReply?: (message: ChatMessage) => void;
  onRegenerate?: (message: ChatMessage) => void;
}

function UserBubbleBody({ message }: { message: ChatMessage }) {
  if (message.replyTo) {
    return (
      <>
        <ChatMessageReplyCard reply={message.replyTo} />
        {message.content.trim() && (
          <p className="chat-thread-reply-text">
            <span className="chat-thread-reply-mention">{replyMentionLabel(message.replyTo)}</span>
            <span className="chat-thread-reply-sep"> : </span>
            {stripChatDisplayText(message.content)
              .split('\n')
              .map((line, i, arr) => (
                <span key={i}>
                  {line}
                  {i < arr.length - 1 && <br />}
                </span>
              ))}
          </p>
        )}
      </>
    );
  }

  return (
    <>
      {stripChatDisplayText(message.content)
        .split('\n')
        .map((line, i, arr) => (
          <span key={i}>
            {line}
            {i < arr.length - 1 && <br />}
          </span>
        ))}
    </>
  );
}

function AssistantBubbleBody({
  content,
  reasoning,
}: {
  content: string;
  reasoning: boolean;
}) {
  if (reasoning) {
    return <ChatReasoningIndicator />;
  }
  if (!content) {
    return <span className="chat-thread-typing">Đang trả lời…</span>;
  }
  return (
    <>
      {stripChatDisplayText(content)
        .split('\n')
        .map((line, i, arr) => (
          <span key={i}>
            {line}
            {i < arr.length - 1 && <br />}
          </span>
        ))}
    </>
  );
}

export default function ChatMessageList({
  messages,
  thinking,
  listRef,
  onReply,
  onRegenerate,
}: Props) {
  const lastMessage = messages[messages.length - 1];

  const handleForward = (message: ChatMessage) => {
    const excerpt = stripChatDisplayText(message.content).slice(0, 280);
    const share = `${excerpt}${message.content.length > 280 ? '…' : ''}`;
    void navigator.clipboard.writeText(share).then(
      () => window.alert('Đã copy nội dung để chuyển tiếp.'),
      () => window.alert('Không copy được nội dung.'),
    );
  };

  return (
    <div className="chat-thread-messages" ref={listRef}>
      {messages.map((m, index) => {
        const isLastAssistant =
          m.role === 'assistant' && index === messages.length - 1 && lastMessage?.id === m.id;
        const reasoning = Boolean(thinking && isLastAssistant && !m.content.trim());
        const showActions =
          m.role === 'assistant' &&
          Boolean(m.content.trim()) &&
          !reasoning &&
          !(thinking && isLastAssistant);

        return (
          <div key={m.id} className={`chat-thread-msg chat-thread-msg--${m.role}`}>
            {m.role === 'assistant' && (
              <span className="chat-thread-msg-avatar">
                <Bot size={14} />
              </span>
            )}
            <div className="chat-thread-msg-body">
              <div
                className={`chat-thread-bubble${reasoning ? ' chat-thread-bubble--reasoning' : ''}${
                  m.replyTo ? ' chat-thread-bubble--reply' : ''
                }${
                  isLastAssistant && thinking && m.content.trim()
                    ? ' chat-thread-bubble--streaming'
                    : ''
                }`}
              >
                {m.imageUrl && (
                  <img className="chat-thread-bubble-img" src={m.imageUrl} alt="đính kèm" />
                )}
                {m.role === 'assistant' ? (
                  <AssistantBubbleBody content={m.content} reasoning={reasoning} />
                ) : (
                  <UserBubbleBody message={m} />
                )}
              </div>
              {showActions && onReply && onRegenerate && (
                <ChatMessageActions
                  content={stripChatDisplayText(m.content)}
                  meta={m.meta}
                  onReply={() => onReply(m)}
                  onRegenerate={() => onRegenerate(m)}
                  onForward={() => handleForward(m)}
                />
              )}
            </div>
          </div>
        );
      })}
      {thinking && lastMessage?.role !== 'assistant' && (
        <div className="chat-thread-msg chat-thread-msg--assistant">
          <span className="chat-thread-msg-avatar">
            <Bot size={14} />
          </span>
          <div className="chat-thread-msg-body">
            <div className="chat-thread-bubble chat-thread-bubble--reasoning">
              <ChatReasoningIndicator />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
