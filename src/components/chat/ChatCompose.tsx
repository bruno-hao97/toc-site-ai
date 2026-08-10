import { useRef, useState, type RefObject } from 'react';
import { ArrowUp, Menu, Percent, Plus, Settings, Square, X } from 'lucide-react';
import { CHAT_COMPOSE_PLACEHOLDERS, CHAT_PILLS, type ChatPill } from '../../services/chatPageData';
import type { ChatMessage } from '../../services/chatSessionsLocal';
import { useTypewriterCycle } from '../../hooks/useTypewriterCycle';
import { useAutoResizeTextarea } from '../../hooks/useAutoResizeTextarea';
import TypewriterCursor from './TypewriterCursor';
import ChatComposeReplyStrip from './ChatComposeReplyStrip';
import ChatComposeAttachMenu from './ChatComposeAttachMenu';

interface Props {
  input: string;
  thinking: boolean;
  uploading?: boolean;
  attachment: { url: string; name: string } | null;
  replyTo?: ChatMessage | null;
  agentName: string;
  agentId: string;
  compact?: boolean;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onStop?: () => void;
  onPickFile: (file: File | null) => void;
  onClearAttachment: () => void;
  onClearReply?: () => void;
  onPill: (pill: ChatPill) => void;
  fileRef: RefObject<HTMLInputElement | null>;
}

export default function ChatCompose({
  input,
  thinking,
  uploading = false,
  attachment,
  replyTo = null,
  agentName,
  agentId,
  compact = false,
  onInputChange,
  onSend,
  onStop,
  onPickFile,
  onClearAttachment,
  onClearReply,
  onPill,
  fileRef,
}: Props) {
  const [focused, setFocused] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachBtnRef = useRef<HTMLButtonElement>(null);
  const busy = thinking || uploading;
  const showTypewriterPlaceholder = !input.trim() && !uploading && !focused && !replyTo;
  const { text: placeholderText, showCursor } = useTypewriterCycle(CHAT_COMPOSE_PLACEHOLDERS, {
    enabled: showTypewriterPlaceholder,
  });

  useAutoResizeTextarea(textareaRef, input, compact ? 1 : 2);

  return (
    <div className={`chat-compose${compact ? ' chat-compose--compact' : ''}`}>
      <div className={`chat-compose-box${busy ? ' chat-compose-box--busy' : ''}`}>
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

        {replyTo && onClearReply && (
          <ChatComposeReplyStrip
            message={replyTo}
            agentName={agentName}
            agentId={agentId}
            onClear={onClearReply}
          />
        )}

        {attachment && (
          <div className="chat-compose-attachment chat-compose-attachment--inline">
            <img src={attachment.url} alt={attachment.name} />
            <span>{attachment.name}</span>
            {uploading && <span className="chat-compose-attachment-status">Đang tải lên…</span>}
            <button type="button" onClick={onClearAttachment} aria-label="Bỏ ảnh" disabled={busy}>
              <X size={13} />
            </button>
          </div>
        )}

        <div className="chat-compose-editor">
          <div className="chat-compose-input-wrap">
            {showTypewriterPlaceholder && (
              <div className="chat-compose-placeholder" aria-hidden>
                {placeholderText}
                {showCursor && <TypewriterCursor />}
              </div>
            )}
            <textarea
              ref={textareaRef}
              className="chat-compose-input"
              placeholder={uploading ? 'Đang tải ảnh lên…' : ' '}
              value={input}
              rows={1}
              onChange={(e) => onInputChange(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (!busy) void onSend();
                }
              }}
              disabled={uploading}
            />
          </div>
        </div>

        <div className="chat-compose-toolbar">
          <div className="chat-compose-toolbar-left">
            <button
              ref={attachBtnRef}
              type="button"
              className="chat-compose-icon"
              onClick={() => setAttachOpen((v) => !v)}
              title="Đính kèm"
              aria-label="Đính kèm"
              aria-expanded={attachOpen}
              disabled={busy}
            >
              <Plus size={18} />
            </button>
            <button
              type="button"
              className="chat-compose-icon"
              disabled
              title="Sắp ra mắt"
              aria-label="Menu"
            >
              <Menu size={16} />
            </button>
          </div>

          <div className="chat-compose-toolbar-right">
            <button
              type="button"
              className="chat-compose-icon"
              disabled
              title="Sắp ra mắt"
              aria-label="Tiến độ"
            >
              <Percent size={16} />
            </button>
            <button
              type="button"
              className="chat-compose-icon"
              disabled
              title="Sắp ra mắt"
              aria-label="Cài đặt"
            >
              <Settings size={16} />
            </button>
            {thinking ? (
              <button
                type="button"
                className="chat-compose-send chat-compose-send--stop"
                onClick={() => onStop?.()}
                aria-label="Dừng"
                title="Dừng"
              >
                <Square size={14} fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                className="chat-compose-send"
                onClick={() => void onSend()}
                disabled={uploading || (!input.trim() && !attachment)}
                aria-label="Gửi"
              >
                <ArrowUp size={18} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </div>

      <ChatComposeAttachMenu
        anchorRef={attachBtnRef}
        open={attachOpen}
        onClose={() => setAttachOpen(false)}
        onUploadImage={() => fileRef.current?.click()}
      />

      {!compact && (
        <div className="chat-compose-pills">
          {CHAT_PILLS.map((pill) => (
            <button
              key={pill.id}
              type="button"
              className="chat-compose-pill"
              onClick={() => onPill(pill)}
              disabled={busy}
            >
              {pill.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
