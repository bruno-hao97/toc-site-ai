import { ChevronDown, Menu, Plus, Share2, Sparkles } from 'lucide-react';
import { BRAND_NAME } from '../../lib/brand';
import type { ChatAiModel } from '../../services/chatAiModels';

interface Props {
  model: ChatAiModel;
  onOpenModelPicker: () => void;
  onNewChat: () => void;
  onOpenSidebar?: () => void;
}

export default function ChatTopBar({ model, onOpenModelPicker, onNewChat, onOpenSidebar }: Props) {
  const onShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      window.alert('Đã copy link trang chat.');
    } catch {
      window.alert('Không copy được link.');
    }
  };

  return (
    <header className="chat-topbar">
      <div className="chat-topbar-left">
        {onOpenSidebar && (
          <button
            type="button"
            className="chat-topbar-menu"
            onClick={onOpenSidebar}
            aria-label="Mở menu"
          >
            <Menu size={18} />
          </button>
        )}
        <button
          type="button"
          className="chat-topbar-pill"
          onClick={onOpenModelPicker}
          aria-label="Chọn model"
        >
          <span>{model.name}</span>
          <ChevronDown size={14} />
        </button>
        <button type="button" className="chat-topbar-pill chat-topbar-pill--agent" disabled>
          <Sparkles size={14} />
          <span>{BRAND_NAME}</span>
          <ChevronDown size={14} />
        </button>
      </div>
      <div className="chat-topbar-actions">
        <button type="button" className="chat-topbar-icon-btn" onClick={onShare} title="Chia sẻ">
          <Share2 size={16} />
          <span>Chia sẻ</span>
        </button>
        <button
          type="button"
          className="chat-topbar-icon-btn"
          onClick={onNewChat}
          title="Chat mới"
          aria-label="Chat mới"
        >
          <Plus size={18} />
        </button>
      </div>
    </header>
  );
}
