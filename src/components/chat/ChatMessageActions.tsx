import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Coins,
  Copy,
  CornerUpLeft,
  MessageSquare,
  MoreVertical,
  RotateCw,
  Share2,
} from 'lucide-react';
import type { ChatMessageMeta } from '../../services/chatSessionsLocal';

interface Props {
  content: string;
  meta?: ChatMessageMeta;
  onReply: () => void;
  onRegenerate: () => void;
  onForward: () => void;
}

export default function ChatMessageActions({
  content,
  meta,
  onReply,
  onRegenerate,
  onForward,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      window.alert('Không copy được văn bản.');
    }
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="chat-msg-actions">
      <div className="chat-msg-actions-icons">
        <div className="chat-msg-actions-more" ref={menuRef}>
          <button
            type="button"
            className="chat-msg-action"
            aria-label="Thêm tùy chọn"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MoreVertical size={14} />
          </button>
          {menuOpen && (
            <div className="chat-msg-menu" role="menu">
              <div className="chat-msg-menu-reactions" aria-hidden>
                {['👍', '☝️', '💯', '🚀', '👎', '🙂'].map((emoji) => (
                  <button key={emoji} type="button" className="chat-msg-menu-emoji" disabled title="Sắp ra mắt">
                    {emoji}
                  </button>
                ))}
              </div>
              <button
                type="button"
                role="menuitem"
                className="chat-msg-menu-item"
                onClick={() => {
                  onReply();
                  closeMenu();
                }}
              >
                <CornerUpLeft size={14} />
                Trả lời
              </button>
              <button
                type="button"
                role="menuitem"
                className="chat-msg-menu-item"
                onClick={() => {
                  onForward();
                  closeMenu();
                }}
              >
                <Share2 size={14} />
                Chuyển tiếp
              </button>
              <button
                type="button"
                role="menuitem"
                className="chat-msg-menu-item"
                onClick={() => {
                  void onRegenerate();
                  closeMenu();
                }}
              >
                <RotateCw size={14} />
                Tạo lại
              </button>
              <div className="chat-msg-menu-divider" />
              <button
                type="button"
                role="menuitem"
                className="chat-msg-menu-item"
                onClick={() => {
                  void copyText();
                  closeMenu();
                }}
              >
                <Copy size={14} />
                Sao chép văn bản
              </button>
              <button type="button" role="menuitem" className="chat-msg-menu-item" disabled title="Sắp ra mắt">
                <MessageSquare size={14} />
                Đánh dấu chưa đọc
              </button>
            </div>
          )}
        </div>

        <button type="button" className="chat-msg-action" title="Trả lời" aria-label="Trả lời" onClick={onReply}>
          <CornerUpLeft size={14} />
        </button>
        <button
          type="button"
          className="chat-msg-action"
          title="Chuyển tiếp"
          aria-label="Chuyển tiếp"
          onClick={onForward}
        >
          <Share2 size={14} />
        </button>
        <button
          type="button"
          className="chat-msg-action"
          title="Sao chép văn bản"
          aria-label="Sao chép văn bản"
          onClick={() => void copyText()}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
        <button
          type="button"
          className="chat-msg-action"
          title="Tạo lại"
          aria-label="Tạo lại"
          onClick={() => void onRegenerate()}
        >
          <RotateCw size={14} />
        </button>
      </div>

      {(meta?.elapsedSec != null || meta?.creditsUsed != null) && (
        <div className="chat-msg-actions-meta">
          {meta.elapsedSec != null && <span>{meta.elapsedSec}s</span>}
          {meta.creditsUsed != null && (
            <span className="chat-msg-actions-credits">
              <Coins size={12} strokeWidth={1.75} aria-hidden />
              {meta.creditsUsed.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} cr
            </span>
          )}
        </div>
      )}
    </div>
  );
}
