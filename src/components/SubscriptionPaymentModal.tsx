import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, CreditCard, Loader2, QrCode, X } from 'lucide-react';
import QRCode from 'qrcode';
import { Link } from 'react-router-dom';
import {
  formatTransferAmountNote,
  type SubscriptionPaymentResult,
} from '../services/subscriptionPlans';

type PaymentTab = 'qr' | 'transfer';

function isImageQrSource(value: string): boolean {
  const trimmed = value.trim();
  return /^(https?:\/\/|data:image\/)/i.test(trimmed);
}

function isEmvQrPayload(value: string): boolean {
  return /^000201/i.test(value.trim());
}

function getRawQrPayload(payment: SubscriptionPaymentResult | null): string {
  if (!payment) return '';
  return (payment.qrImage || payment.qrUrl || '').trim();
}

interface Props {
  open: boolean;
  planName: string;
  planPrice?: string;
  payment: SubscriptionPaymentResult | null;
  statusMessage?: string;
  onClose: () => void;
}

function formatPaymentAmountFromPlan(value: string): { raw: string; formatted: string } {
  const numeric = Number(value.replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(numeric) || numeric <= 0) return { raw: '', formatted: '' };
  const rounded = Math.round(numeric);
  return {
    raw: String(rounded),
    formatted: `${rounded.toLocaleString('en-US')} VND`,
  };
}

async function copyText(text: string): Promise<void> {
  if (!text) return;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="pricing-payment-field">
      <span className="pricing-payment-field-label">{label}</span>
      <div className="pricing-payment-field-row">
        <strong>{value || '—'}</strong>
        {value ? (
          <button
            type="button"
            className="pricing-payment-copy"
            onClick={() => {
              void copyText(value).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1400);
              });
            }}
          >
            <Copy size={13} />
            {copied ? 'Đã chép' : 'Sao chép'}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function SubscriptionPaymentModal({
  open,
  planName,
  planPrice,
  payment,
  statusMessage,
  onClose,
}: Props) {
  const [tab, setTab] = useState<PaymentTab>('qr');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrLoading, setQrLoading] = useState(false);

  const rawQrPayload = useMemo(() => getRawQrPayload(payment), [payment]);
  const qrImageUrl = useMemo(
    () => (isImageQrSource(rawQrPayload) ? rawQrPayload : ''),
    [rawQrPayload],
  );
  const embeddedUrl = payment?.urlEmbedded || payment?.url || '';
  const hasQrTab = Boolean(rawQrPayload || embeddedUrl);

  const transferInfo = useMemo(() => {
    const bankTransfer = payment?.bankTransfer;
    if (!bankTransfer && !planPrice) return undefined;
    if (!bankTransfer) {
      const amount = formatPaymentAmountFromPlan(planPrice || '');
      return {
        accountName: '',
        bankName: '',
        accountNumber: '',
        amount: amount.raw,
        amountFormatted: amount.formatted,
        content: '',
      };
    }
    if (bankTransfer.amountFormatted || !planPrice) return bankTransfer;
    const amount = formatPaymentAmountFromPlan(planPrice);
    return {
      ...bankTransfer,
      amount: bankTransfer.amount || amount.raw,
      amountFormatted: bankTransfer.amountFormatted || amount.formatted,
    };
  }, [payment?.bankTransfer, planPrice]);

  const hasTransferTab = Boolean(
    transferInfo?.accountNumber || transferInfo?.content || transferInfo?.accountName || transferInfo?.amountFormatted,
  );

  useEffect(() => {
    if (!open) {
      setQrDataUrl('');
      setQrLoading(false);
      return;
    }

    if (qrImageUrl) {
      setQrDataUrl(qrImageUrl);
      setQrLoading(false);
      return;
    }

    if (!isEmvQrPayload(rawQrPayload)) {
      setQrDataUrl('');
      setQrLoading(false);
      return;
    }

    let active = true;
    setQrLoading(true);
    void QRCode.toDataURL(rawQrPayload, { width: 280, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (!active) return;
        setQrDataUrl(url);
      })
      .catch(() => {
        if (!active) return;
        setQrDataUrl('');
      })
      .finally(() => {
        if (active) setQrLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, rawQrPayload, qrImageUrl]);

  useEffect(() => {
    if (!open) return;
    if (hasQrTab) {
      setTab('qr');
      return;
    }
    if (hasTransferTab) setTab('transfer');
  }, [open, hasQrTab, hasTransferTab, payment?.url, payment?.urlEmbedded]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !payment) return null;

  const amountNote = transferInfo?.amount ? formatTransferAmountNote(transferInfo.amount) : '';

  return createPortal(
    <div className="pricing-payment-backdrop" onClick={onClose}>
      <div
        className="pricing-payment-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pricing-payment-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pricing-payment-head">
          <div>
            <h2 id="pricing-payment-title">Thanh toán</h2>
            <p>{planName}</p>
          </div>
          <button type="button" className="pricing-payment-close" aria-label="Đóng" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="pricing-payment-tabs" role="tablist" aria-label="Phương thức thanh toán">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'qr'}
            className={`pricing-payment-tab ${tab === 'qr' ? 'active' : ''}`}
            onClick={() => setTab('qr')}
            disabled={!hasQrTab}
          >
            <QrCode size={15} />
            Quét mã QR
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'transfer'}
            className={`pricing-payment-tab ${tab === 'transfer' ? 'active' : ''}`}
            onClick={() => setTab('transfer')}
            disabled={!hasTransferTab}
          >
            <CreditCard size={15} />
            Chuyển khoản
          </button>
        </div>

        <div className="pricing-payment-body">
          {tab === 'qr' ? (
            <div className="pricing-payment-qr-pane">
              {qrLoading ? (
                <div className="pricing-payment-qr-loading">
                  <Loader2 size={20} className="spin" />
                  <span>Đang tạo mã QR...</span>
                </div>
              ) : qrDataUrl ? (
                <img className="pricing-payment-qr-image" src={qrDataUrl} alt={`Mã QR thanh toán ${planName}`} />
              ) : embeddedUrl ? (
                <iframe
                  className="pricing-payment-qr-frame"
                  src={embeddedUrl}
                  title={`Thanh toán QR ${planName}`}
                  loading="lazy"
                />
              ) : (
                <p className="muted">Không có mã QR cho giao dịch này.</p>
              )}
            </div>
          ) : (
            <div className="pricing-payment-transfer-pane">
              {transferInfo?.accountName ? (
                <p className="pricing-payment-recipient">{transferInfo.accountName}</p>
              ) : null}
              {transferInfo?.bankName ? <p className="pricing-payment-bank">{transferInfo.bankName}</p> : null}

              <CopyField label="Số tài khoản" value={transferInfo?.accountNumber || ''} />
              <CopyField label="Số tiền" value={transferInfo?.amountFormatted || ''} />
              <CopyField label="Nội dung" value={transferInfo?.content || ''} />

              {amountNote ? (
                <p className="pricing-payment-transfer-note">
                  Lưu ý: Nhập chính xác số tiền <strong>{amountNote}</strong> khi chuyển khoản
                </p>
              ) : null}

              {!hasTransferTab ? <p className="muted">Không có thông tin chuyển khoản cho giao dịch này.</p> : null}
            </div>
          )}
        </div>

        <div className="pricing-payment-foot">
          {statusMessage ? <p className="pricing-payment-status">{statusMessage}</p> : null}
          <p>
            Sau khi thanh toán thành công bạn có thể truy cập{' '}
            <Link to="/account" onClick={onClose}>
              trang quản lý tài khoản
            </Link>
            .
          </p>
          <button type="button" className="pricing-payment-close-btn" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
