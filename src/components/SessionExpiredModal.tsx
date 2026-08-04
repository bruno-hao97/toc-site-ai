import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { LogIn, ShieldAlert } from 'lucide-react';

interface Props {
  open: boolean;
  message: string;
  onLogin: () => void;
}

export default function SessionExpiredModal({ open, message, onLogin }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onLogin();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onLogin]);

  if (!open) return null;

  return createPortal(
    <div className="session-expired-backdrop" role="presentation">
      <div
        className="session-expired-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-expired-title"
        aria-describedby="session-expired-desc"
      >
        <div className="session-expired-icon" aria-hidden>
          <ShieldAlert size={28} />
        </div>
        <h2 id="session-expired-title">Phiên đăng nhập hết hạn</h2>
        <p id="session-expired-desc" className="session-expired-message">
          {message}
        </p>
        <button type="button" className="session-expired-login-btn" onClick={onLogin}>
          <LogIn size={18} />
          Đăng nhập lại
        </button>
      </div>
    </div>,
    document.body,
  );
}
