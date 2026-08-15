import { Link } from 'react-router-dom';
import { Plus, Search, Sparkles, Trash2, Workflow, X } from 'lucide-react';
import BrandLogo from '../BrandLogo';
import { BRAND_NAME } from '../../lib/brand';
import { getDisplayUser } from '../../services/authStore';
import type { ChatSessionSummary } from '../../services/chatSessionsLocal';
import ProjectPicker from '../ProjectPicker';

interface Props {
  sessions: ChatSessionSummary[];
  activeSessionId: string | null;
  search: string;
  credits: number;
  open?: boolean;
  onSearchChange: (q: string) => void;
  onNewChat: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onClose?: () => void;
}

export default function ChatSidebar({
  sessions,
  activeSessionId,
  search,
  credits,
  open = false,
  onSearchChange,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  onClose,
}: Props) {
  const user = getDisplayUser();
  const q = search.trim().toLowerCase();
  const filtered = q
    ? sessions.filter((s) => s.title.toLowerCase().includes(q))
    : sessions;

  const select = (sid: string) => {
    onSelectSession(sid);
    onClose?.();
  };

  const newChat = () => {
    onNewChat();
    onClose?.();
  };

  return (
    <>
      {open && (
        <button
          type="button"
          className="chat-sidebar-backdrop"
          aria-label="Đóng menu"
          onClick={onClose}
        />
      )}
      <aside
        className={`chat-sidebar${open ? ' chat-sidebar--open' : ''}`}
        aria-label="Chat sidebar"
      >
        <div className="chat-sidebar-top">
          <div className="chat-sidebar-brand-row">
            <BrandLogo to="/home" className="chat-sidebar-logo" />
            {onClose && (
              <button
                type="button"
                className="chat-sidebar-close"
                onClick={onClose}
                aria-label="Đóng sidebar"
              >
                <X size={18} />
              </button>
            )}
          </div>
          <div className="chat-sidebar-search-row">
            <div className="chat-sidebar-search">
              <Search size={15} aria-hidden />
              <input
                type="search"
                placeholder="Tìm kiếm đoạn chat"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                aria-label="Tìm kiếm đoạn chat"
              />
            </div>
            <button
              type="button"
              className="chat-sidebar-new"
              onClick={newChat}
              title="Chat mới"
              aria-label="Chat mới"
            >
              <Plus size={18} />
            </button>
          </div>
          <Link to="/workflow" className="chat-sidebar-auto-wf" onClick={() => onClose?.()}>
            <Workflow size={16} />
            Auto Workflow
          </Link>
        </div>

        <div className="chat-sidebar-section">
          <span className="chat-sidebar-section-label">Dự án</span>
          <button type="button" className="chat-sidebar-row chat-sidebar-row--static">
            <span className="chat-sidebar-row-icon">📁</span>
            <span className="chat-sidebar-row-text">Mặc định</span>
          </button>
        </div>

        <div className="chat-sidebar-section">
          <span className="chat-sidebar-section-label">Agent</span>
          <button type="button" className="chat-sidebar-row chat-sidebar-row--static active">
            <Sparkles size={16} className="chat-sidebar-row-icon-svg" />
            <span className="chat-sidebar-row-text">{BRAND_NAME}</span>
          </button>
        </div>

        <div className="chat-sidebar-section chat-sidebar-history">
          <span className="chat-sidebar-section-label">Gần đây</span>
          {filtered.length === 0 ? (
            <p className="chat-sidebar-empty">Chưa có đoạn chat.</p>
          ) : (
            <ul className="chat-sidebar-list">
              {filtered.map((s) => (
                <li key={s.sessionId} className="chat-sidebar-row-wrap">
                  <button
                    type="button"
                    className={`chat-sidebar-row${activeSessionId === s.sessionId ? ' active' : ''}`}
                    onClick={() => select(s.sessionId)}
                    title={s.title}
                  >
                    <span className="chat-sidebar-row-text">{s.title}</span>
                  </button>
                  <ProjectPicker
                    className="chat-sidebar-project-picker"
                    snapshot={{
                      itemId: s.sessionId,
                      type: 'chat',
                      prompt: s.title,
                      createdTime: s.updatedAt,
                    }}
                  />
                  <button
                    type="button"
                    className="chat-sidebar-row-delete"
                    title="Xóa đoạn chat"
                    aria-label={`Xóa ${s.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(s.sessionId);
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="chat-sidebar-footer">
          <div className="chat-sidebar-user">
            <span className="chat-sidebar-avatar" aria-hidden>
              {(user.name || user.email || '?').slice(0, 1).toUpperCase()}
            </span>
            <div className="chat-sidebar-user-meta">
              <span className="chat-sidebar-user-name">{user.name || user.email}</span>
              <span className="chat-sidebar-user-credits">{credits.toLocaleString('vi-VN')}</span>
            </div>
          </div>
        </footer>
      </aside>
    </>
  );
}
