import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { FolderOpen, ImageIcon, Link2, Upload, Video } from 'lucide-react';

interface MenuPos {
  top: number;
  left: number;
}

export default function ComposerMediaSourceMenu({
  anchorRef,
  onClose,
  onUpload,
  onAlbum,
  onAlbumImage,
  onAlbumVideo,
  onLink,
  albumMode = 'single',
}: {
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onUpload: () => void;
  onAlbum?: () => void;
  onAlbumImage?: () => void;
  onAlbumVideo?: () => void;
  onLink: () => void;
  albumMode?: 'single' | 'split';
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<MenuPos | null>(null);

  useLayoutEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = albumMode === 'split' ? 196 : 168;
    let left = r.left + r.width / 2 - width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    setPos({ top: r.bottom + 6, left });
  }, [anchorRef, albumMode]);

  useEffect(() => {
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
  }, [anchorRef, onClose]);

  if (!pos) return null;

  return createPortal(
    <div
      ref={panelRef}
      className="cms-source-menu"
      style={{ top: pos.top, left: pos.left }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => {
          onUpload();
          onClose();
        }}
      >
        <Upload size={15} /> Tải lên
      </button>
      {albumMode === 'split' ? (
        <>
          <button
            type="button"
            onClick={() => {
              onAlbumImage?.();
              onClose();
            }}
          >
            <ImageIcon size={15} /> Từ album ảnh
          </button>
          <button
            type="button"
            onClick={() => {
              onAlbumVideo?.();
              onClose();
            }}
          >
            <Video size={15} /> Từ album video
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => {
            onAlbum?.();
            onClose();
          }}
        >
          <FolderOpen size={15} /> Từ album
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          onLink();
          onClose();
        }}
      >
        <Link2 size={15} /> Từ link
      </button>
    </div>,
    document.body,
  );
}
