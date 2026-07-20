import { type ReactNode, useRef, useState } from 'react';
import ComposerMediaAlbumModal from './ComposerMediaAlbumModal';
import ComposerMediaLinkModal from './ComposerMediaLinkModal';
import ComposerMediaSourceMenu from './ComposerMediaSourceMenu';

export default function ComposerMediaPickButton({
  kind,
  onFile,
  onUrl,
  children,
  className,
  title,
  multiple = false,
}: {
  kind: 'image' | 'video' | 'any';
  onFile: (file: File) => void | Promise<void>;
  onUrl: (url: string) => void | Promise<void>;
  children: ReactNode;
  className?: string;
  title?: string;
  multiple?: boolean;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const accept =
    kind === 'video' ? 'video/*' : kind === 'image' ? 'image/*' : 'image/*,video/*';
  const resolvedAlbumKind: 'image' | 'video' = kind === 'video' ? 'video' : 'image';
  const [menuOpen, setMenuOpen] = useState(false);
  const [albumOpen, setAlbumOpen] = useState(false);
  const [albumTab, setAlbumTab] = useState<'image' | 'video'>(resolvedAlbumKind);
  const [linkOpen, setLinkOpen] = useState(false);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className={className}
        title={title}
        onClick={() => setMenuOpen(true)}
      >
        {children}
        <input
          ref={fileRef}
          type="file"
          accept={accept}
          hidden
          multiple={multiple}
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            e.target.value = '';
            if (multiple) {
              for (const f of files) void onFile(f);
            } else if (files[0]) {
              void onFile(files[0]);
            }
          }}
        />
      </button>

      {menuOpen && (
        <ComposerMediaSourceMenu
          anchorRef={anchorRef}
          onClose={() => setMenuOpen(false)}
          onUpload={() => fileRef.current?.click()}
          albumMode={kind === 'any' ? 'split' : 'single'}
          onAlbum={kind === 'any' ? undefined : () => setAlbumOpen(true)}
          onAlbumImage={
            kind === 'any'
              ? () => {
                  setAlbumTab('image');
                  setAlbumOpen(true);
                }
              : undefined
          }
          onAlbumVideo={
            kind === 'any'
              ? () => {
                  setAlbumTab('video');
                  setAlbumOpen(true);
                }
              : undefined
          }
          onLink={() => setLinkOpen(true)}
        />
      )}

      <ComposerMediaAlbumModal
        open={albumOpen}
        kind={kind === 'any' ? albumTab : resolvedAlbumKind}
        allowBoth={false}
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
