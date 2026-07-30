import type { RefObject } from 'react';
import { ArrowUp, Mic, Paperclip, Plus, Square, X } from 'lucide-react';
import { CHAT_PILLS, type ChatPill } from '../../services/chatPageData';

interface Props {
  input: string;
  thinking: boolean;
  uploading?: boolean;
  attachment: { url: string; name: string } | null;
  compact?: boolean;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onStop?: () => void;
  onPickFile: (file: File | null) => void;
  onClearAttachment: () => void;
  onPill: (pill: ChatPill) => void;
  fileRef: RefObject<HTMLInputElement | null>;
}

export default function ChatCompose({
  input,
  thinking,
  uploading = false,
  attachment,
  compact = false,
  onInputChange,
  onSend,
  onStop,
  onPickFile,
  onClearAttachment,
  onPill,
  fileRef,
}: Props) {
  const busy = thinking || uploading;
  return (
    <div className={`chat-compose${compact ? ' chat-compose--compact' : ''}`}>
      {attachment && (
        <div className="chat-compose-attachment">
          <img src={attachment.url} alt={attachment.name} />
          <span>{attachment.name}</span>
          {uploading && <span className="chat-compose-attachment-status">Đang tải lên…</span>}
          <button type="button" onClick={onClearAttachment} aria-label="Bỏ ảnh" disabled={busy}>
            <X size={13} />
          </button>
        </div>
      )}
      <div className="chat-compose-box">
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
        <div className="chat-compose-inner">
          <button
            type="button"
            className="chat-compose-icon"
            onClick={() => fileRef.current?.click()}
            title="Đính kèm ảnh"
            aria-label="Đính kèm ảnh"
            disabled={busy}
          >
            <Paperclip size={16} />
          </button>
          {!compact && (
            <button type="button" className="chat-compose-icon" disabled title="Sắp ra mắt">
              <Plus size={16} />
            </button>
          )}
          <textarea
            className="chat-compose-input"
            placeholder={
              uploading
                ? 'Đang tải ảnh lên…'
                : 'Bạn muốn hỏi, tạo app, hay xây dựng ý tưởng gì hôm nay?'
            }
            value={input}
            rows={compact ? 1 : 2}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!busy) void onSend();
              }
            }}
            disabled={uploading}
          />
          <button type="button" className="chat-compose-icon" disabled title="Sắp ra mắt">
            <Mic size={16} />
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
