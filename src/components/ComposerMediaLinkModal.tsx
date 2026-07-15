import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link2, X } from 'lucide-react';
import { validateMediaUrl } from '../services/mediaUrlValidation';

export default function ComposerMediaLinkModal({
  open,
  kind,
  onClose,
  onConfirm,
}: {
  open: boolean;
  kind: 'image' | 'video' | 'any';
  onClose: () => void;
  onConfirm: (url: string) => void;
}) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setUrl('');
      setError('');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = () => {
    const err = validateMediaUrl(url, kind);
    if (err) {
      setError(err);
      return;
    }
    onConfirm(url.trim());
    onClose();
  };

  return createPortal(
    <div className="cms-modal-backdrop" onClick={onClose}>
      <div className="cms-modal cms-link-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cms-modal-head">
          <h3>
            <Link2 size={16} /> Dán link media
          </h3>
          <button type="button" className="cms-modal-close" aria-label="Đóng" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <p className="cms-link-hint">
          Dán URL {kind === 'video' ? 'video' : kind === 'image' ? 'ảnh' : 'ảnh hoặc video'} công khai
          (https://…).
        </p>
        <input
          className="cms-link-input"
          autoFocus
          value={url}
          placeholder="https://…"
          onChange={(e) => {
            setUrl(e.target.value);
            setError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
        />
        {error && <p className="cms-modal-error">{error}</p>}
        <div className="cms-link-actions">
          <button type="button" className="cms-link-cancel" onClick={onClose}>
            Hủy
          </button>
          <button type="button" className="cms-link-confirm" onClick={submit}>
            Dùng link
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
