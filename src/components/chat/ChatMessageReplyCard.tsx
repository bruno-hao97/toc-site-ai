import { CornerUpLeft, X } from 'lucide-react';
import type { ChatMessageReplyRef } from '../../services/chatSessionsLocal';
import { replyTargetLabel } from '../../services/chatReply';

export default function ChatMessageReplyCard({
  reply,
  onClear,
  variant = 'sent',
}: {
  reply: ChatMessageReplyRef;
  onClear?: () => void;
  variant?: 'compose' | 'sent';
}) {
  const replyTarget = reply.role === 'assistant' ? 'AGI' : 'bạn';

  return (
    <div className={`chat-reply-card${variant === 'compose' ? ' chat-reply-card--compose' : ''}`}>
      <div className="chat-reply-card-head">
        <span className="chat-reply-card-label">
          Đang phản hồi nhanh tới {replyTarget} — Reply lại
        </span>
        {onClear ? (
          <button
            type="button"
            className="chat-reply-card-clear"
            onClick={onClear}
            aria-label="Hủy phản hồi"
          >
            <X size={14} />
          </button>
        ) : (
          <CornerUpLeft size={14} className="chat-reply-card-icon" aria-hidden />
        )}
      </div>
      <div className="chat-reply-card-body">
        <span className="chat-reply-card-tag">{replyTargetLabel(reply)}</span>
        <p className="chat-reply-card-excerpt">{reply.excerpt || '(Tin nhắn trống)'}</p>
      </div>
    </div>
  );
}
