import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Download, Eye, MoreVertical, Send, Trash2 } from 'lucide-react';
import ComposerSelectCircle from './ComposerSelectCircle';
import { feedMediaUrl, feedThumb, type FeedItem } from '../services/feedApi';
import {
  feedModelDisplay,
  feedResolutionLabel,
} from '../services/feedLibraryMeta';
import { downloadMediaUrl } from '../utils/downloadMedia';

function ratioClass(ratio?: string): string {
  const r = (ratio || '').replace(/\s/g, '').toLowerCase();
  if (r === '16:9' || r === '16/9') return 'ratio-169';
  if (r === '9:16' || r === '9/16') return 'ratio-916';
  if (r === '1:1' || r === '1/1') return 'ratio-11';
  if (r === '3:2' || r === '3/2') return 'ratio-32';
  if (r === '2:3' || r === '2/3') return 'ratio-23';
  return 'ratio-auto';
}

export default function ComposerLibraryItem({
  item,
  kind,
  selected,
  onToggleSelect,
  onPreview,
  onDelete,
  deleting = false,
  extraMenuItems,
}: {
  item: FeedItem;
  kind: 'image' | 'video';
  selected: boolean;
  onToggleSelect?: () => void;
  onPreview: () => void;
  onDelete?: () => void;
  deleting?: boolean;
  extraMenuItems?: { label: string; icon?: ReactNode; onClick: () => void }[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const thumb = feedThumb(item);
  const fullUrl = feedMediaUrl(item) || thumb;
  const model = feedModelDisplay(item);
  const res = feedResolutionLabel(item);
  const ratio = ratioClass(item.ratio);
  const isVideo = kind === 'video';
  const prompt = (item.prompt || '').trim();

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

  return (
    <div
      className={`clib-item ${ratio}${selected ? ' selected' : ''}`}
      title={prompt || model || item.id_base}
    >
      {onToggleSelect && (
        <ComposerSelectCircle selected={selected} onToggle={onToggleSelect} />
      )}

      <div className="clib-item-media">
        {thumb ? (
          isVideo ? (
            <video src={thumb} muted preload="metadata" />
          ) : (
            <img src={thumb} alt="" loading="lazy" />
          )
        ) : (
          <span className="clib-placeholder" />
        )}
      </div>

      <div className="clib-badges">
        {model && <span className="clib-badge">{model}</span>}
        {res && <span className="clib-badge dim">{res}</span>}
      </div>

      {prompt && <span className="clib-prompt">{prompt}</span>}

      <div className="clib-item-actions">
        <button
          type="button"
          className="clib-action-btn"
          aria-label="Xem"
          onClick={(e) => {
            e.stopPropagation();
            onPreview();
          }}
        >
          <Eye size={16} />
        </button>
        <button
          type="button"
          className="clib-action-btn"
          aria-label="Tải xuống"
          onClick={(e) => {
            e.stopPropagation();
            if (fullUrl) void downloadMediaUrl(fullUrl);
          }}
        >
          <Download size={16} />
        </button>
        <div className="clib-item-menu-wrap" ref={menuRef}>
          <button
            type="button"
            className="clib-action-btn"
            aria-label="Thêm"
            aria-expanded={menuOpen}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <div className="clib-item-menu">
              <button type="button" disabled title="Chưa hỗ trợ">
                <Send size={14} />
                Gửi tới thiết bị
              </button>
              {extraMenuItems?.map((menuItem) => (
                <button
                  key={menuItem.label}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    menuItem.onClick();
                  }}
                >
                  {menuItem.icon}
                  {menuItem.label}
                </button>
              ))}
              <button
                type="button"
                className="danger"
                disabled={deleting || !onDelete}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onDelete?.();
                }}
              >
                <Trash2 size={14} />
                Xóa
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
