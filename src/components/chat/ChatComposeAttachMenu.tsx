import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import {
  ExternalLink,
  FolderOpen,
  Link2,
  Search,
  Sparkles,
  Upload,
  Wand2,
} from 'lucide-react';

type AttachTab = 'attach' | 'options';
type MediaTab = 'image' | 'video' | 'audio' | 'document';

const MEDIA_TABS: { id: MediaTab; label: string }[] = [
  { id: 'image', label: 'Ảnh' },
  { id: 'video', label: 'Video' },
  { id: 'audio', label: 'Audio' },
  { id: 'document', label: 'Tài liệu' },
];

const ATTACH_ACTIONS = [
  { id: 'upload', label: 'Tải lên', icon: Upload },
  { id: 'album', label: 'Chọn từ Album', icon: FolderOpen },
  { id: 'link', label: 'Link', icon: Link2 },
  { id: 'extract', label: 'Extract from Link', icon: ExternalLink },
] as const;

const OPTION_ITEMS = [
  { id: 'search', label: 'Tìm kiếm web', icon: Search },
  { id: 'deep', label: 'Phân tích sâu', icon: Sparkles },
  { id: 'enhance', label: 'Cải thiện prompt', icon: Wand2 },
] as const;

interface MenuPos {
  top: number;
  left: number;
}

export default function ChatComposeAttachMenu({
  anchorRef,
  open,
  onClose,
  onUploadImage,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  onUploadImage: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<MenuPos | null>(null);
  const [attachTab, setAttachTab] = useState<AttachTab>('attach');
  const [mediaTab, setMediaTab] = useState<MediaTab>('image');

  useLayoutEffect(() => {
    if (!open) return;
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = 320;
    const estimatedHeight = 280;
    let left = r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    const top = Math.max(8, r.top - estimatedHeight - 8);
    setPos({ top, left });
  }, [anchorRef, open, attachTab]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (
        panelRef.current?.contains(e.target as Node) ||
        anchorRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [anchorRef, onClose, open]);

  const onAction = (actionId: (typeof ATTACH_ACTIONS)[number]['id']) => {
    if (attachTab === 'attach' && mediaTab === 'image' && actionId === 'upload') {
      onUploadImage();
      onClose();
      return;
    }
    window.alert('Tính năng sắp ra mắt.');
  };

  const onOption = () => {
    window.alert('Tính năng sắp ra mắt.');
  };

  if (!open || !pos) return null;

  return createPortal(
    <div
      ref={panelRef}
      className="chat-compose-attach-menu"
      style={{ top: pos.top, left: pos.left }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="chat-compose-attach-tabs">
        <button
          type="button"
          className={attachTab === 'attach' ? 'is-active' : undefined}
          onClick={() => setAttachTab('attach')}
        >
          Đính kèm
        </button>
        <button
          type="button"
          className={attachTab === 'options' ? 'is-active' : undefined}
          onClick={() => setAttachTab('options')}
        >
          Tùy chọn
        </button>
      </div>

      {attachTab === 'attach' ? (
        <>
          <div className="chat-compose-attach-subtabs">
            {MEDIA_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={mediaTab === tab.id ? 'is-active' : undefined}
                onClick={() => setMediaTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="chat-compose-attach-actions">
            {ATTACH_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <button key={action.id} type="button" onClick={() => onAction(action.id)}>
                  <Icon size={15} />
                  {action.label}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div className="chat-compose-attach-options">
          {OPTION_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} type="button" onClick={onOption}>
                <Icon size={15} />
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>,
    document.body,
  );
}
