import { type ReactNode, useRef, useState } from 'react';
import ComposerMediaAlbumModal from './ComposerMediaAlbumModal';
import ComposerMediaLinkModal from './ComposerMediaLinkModal';
import ComposerMediaSourceMenu from './ComposerMediaSourceMenu';

type MediaKind = 'image' | 'video' | 'any';

function acceptAttr(kind: MediaKind): string {
  if (kind === 'video') return 'video/*';
  if (kind === 'image') return 'image/*';
  return 'image/*,video/*';
}

function albumKind(kind: MediaKind): 'image' | 'video' {
  return kind === 'video' ? 'video' : 'image';
}

export default function ComposerMediaSlot({
  kind,
  value,
  onFile,
  onUrl,
  emptyIcon,
  emptyTitle,
  emptyHint,
  className = 'composer-motion-drop',
  previewClassName = 'composer-motion-preview',
}: {
  kind: MediaKind;
  value?: string | null;
  onFile: (file: File) => void | Promise<void>;
  onUrl: (url: string) => void | Promise<void>;
  emptyIcon?: ReactNode;
  emptyTitle: string;
  emptyHint?: string;
  className?: string;
  previewClassName?: string;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [albumOpen, setAlbumOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  const previewKind =
    value && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(value) ? 'video' : 'image';

  return (
    <>
      <div
        ref={anchorRef}
        className={className}
        role="button"
        tabIndex={0}
        onClick={() => setMenuOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setMenuOpen(true);
          }
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const file = e.dataTransfer.files?.[0];
          if (file) void onFile(file);
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept={acceptAttr(kind)}
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void onFile(file);
          }}
        />
        {value ? (
          previewKind === 'video' ? (
            <video className={previewClassName} src={value} muted loop playsInline />
          ) : (
            <img className={previewClassName} src={value} alt="" />
          )
        ) : (
          <>
            <span className="composer-dropzone-plus">{emptyIcon}</span>
            <span className="composer-dropzone-text">{emptyTitle}</span>
            {emptyHint && <span className="composer-dropzone-hint">{emptyHint}</span>}
          </>
        )}
      </div>

      {menuOpen && (
        <ComposerMediaSourceMenu
          anchorRef={anchorRef}
          onClose={() => setMenuOpen(false)}
          onUpload={() => fileRef.current?.click()}
          onAlbum={() => setAlbumOpen(true)}
          onLink={() => setLinkOpen(true)}
        />
      )}

      <ComposerMediaAlbumModal
        open={albumOpen}
        kind={albumKind(kind)}
        allowBoth={kind === 'any'}
        onClose={() => setAlbumOpen(false)}
        onSelect={(url) => void onUrl(url)}
      />

      <ComposerMediaLinkModal
        open={linkOpen}
        kind={kind}
        onClose={() => setLinkOpen(false)}
        onConfirm={(url) => void onUrl(url)}
      />
    </>
  );
}
