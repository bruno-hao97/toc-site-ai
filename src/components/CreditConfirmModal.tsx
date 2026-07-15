import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Coins, Loader2, X } from 'lucide-react';
import type { CreditPackage } from '../services/topupApi';

interface Props {
  open: boolean;
  creditPackage: CreditPackage | null;
  confirming: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: () => void;
}

function formatVnd(value: number): string {
  return `${value.toLocaleString('vi-VN')}đ`;
}

export default function CreditConfirmModal({
  open,
  creditPackage,
  confirming,
  error,
  onClose,
  onConfirm,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !confirming) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, confirming, onClose]);

  if (!open || !creditPackage) return null;

  return createPortal(
    <div className="pricing-confirm-backdrop" onClick={confirming ? undefined : onClose}>
      <div
        className="pricing-credit-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="credit-confirm-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="pricing-confirm-close"
          aria-label="Đóng"
          onClick={onClose}
          disabled={confirming}
        >
          <X size={18} />
        </button>

        <div className="pricing-credit-confirm-icon">
          <Coins size={28} />
        </div>
        <h2 id="credit-confirm-title">Xác nhận mua Credit</h2>
        <p className="muted">Bạn có chắc chắn muốn mua gói này?</p>

        <div className="pricing-credit-confirm-summary">
          <div>
            <span>Gói</span>
            <strong>{creditPackage.name}</strong>
          </div>
          <div>
            <span>Giá</span>
            <strong>{formatVnd(creditPackage.amountVnd)}</strong>
          </div>
          <div>
            <span>Credits nhận được</span>
            <strong className="accent">{creditPackage.credits.toLocaleString('vi-VN')} Credits</strong>
          </div>
        </div>

        <p className="pricing-credit-expiry-note">
          Credit nạp sẽ hết hạn sau 3 tháng kể từ ngày nạp.
        </p>

        {error ? <p className="pricing-confirm-error">{error}</p> : null}

        <div className="pricing-confirm-actions">
          <button type="button" className="pricing-confirm-cancel" onClick={onClose} disabled={confirming}>
            Hủy
          </button>
          <button type="button" className="pricing-confirm-submit" onClick={onConfirm} disabled={confirming}>
            {confirming ? <Loader2 size={16} className="spin" /> : null}
            {confirming ? 'Đang tạo thanh toán...' : 'Xác nhận'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
