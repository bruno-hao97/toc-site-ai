import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Crown, Loader2, X } from 'lucide-react';
import type { SubscriptionPlan, SubscriptionPlanModel } from '../services/subscriptionPlans';

interface PlanHighlight {
  label: string;
  value: string;
}

interface Props {
  open: boolean;
  plan: SubscriptionPlan | null;
  confirming: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: (promoCode: string) => void;
}

function formatCurrencyVnd(value?: string): string {
  if (!value) return 'Liên hệ';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  return `${amount.toLocaleString('vi-VN')}đ`;
}

function normalizeFieldValue(value?: string): string {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '0';
  if (/^unlimited$/i.test(trimmed)) return 'Unlimited';
  return trimmed;
}

function formatSavePercent(value?: string): string | null {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;
  if (/giảm/i.test(trimmed)) return trimmed;
  const numeric = trimmed.replace(/%/g, '').trim();
  if (!numeric) return null;
  return `GIẢM ${numeric}%`;
}

function modelTags(model: SubscriptionPlanModel): string[] {
  const tags: string[] = [];
  const add = (items?: Array<{ name?: string; type?: string } | string>) => {
    for (const item of items || []) {
      if (typeof item === 'string') {
        if (item.trim()) tags.push(item.trim());
        continue;
      }
      const label = item.name || item.type || '';
      if (label.trim()) tags.push(label.trim());
    }
  };
  add(model.modes);
  add(model.resolutions);
  add(model.durations);
  add(model.ratios);
  return tags;
}

function planHighlights(plan: SubscriptionPlan): PlanHighlight[] {
  const rows: Array<PlanHighlight | null> = [
    plan.video_month ? { label: 'Video/tháng', value: normalizeFieldValue(plan.video_month) } : null,
    plan.video_day ? { label: 'Video/ngày', value: normalizeFieldValue(plan.video_day) } : null,
    plan.image_month ? { label: 'Ảnh/tháng', value: normalizeFieldValue(plan.image_month) } : null,
    plan.image_day ? { label: 'Ảnh/ngày', value: normalizeFieldValue(plan.image_day) } : null,
    plan.concurrent ? { label: 'Đồng thời', value: normalizeFieldValue(plan.concurrent) } : null,
    plan.queue ? { label: 'Hàng chờ', value: normalizeFieldValue(plan.queue) } : null,
    plan.storage ? { label: 'Lưu trữ', value: normalizeFieldValue(plan.storage) } : null,
  ];
  return rows.filter((row): row is PlanHighlight => row !== null && row.value !== '0');
}

export default function SubscriptionConfirmModal({
  open,
  plan,
  confirming,
  error,
  onClose,
  onConfirm,
}: Props) {
  const [promoCode, setPromoCode] = useState('');

  useEffect(() => {
    if (open) setPromoCode('');
  }, [open, plan?.id_base]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirming) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, confirming, onClose]);

  const models = useMemo(() => plan?.models || [], [plan]);
  const highlights = useMemo(() => (plan ? planHighlights(plan) : []), [plan]);
  const saveLabel = formatSavePercent(plan?.save_percent);

  if (!open || !plan) return null;

  return createPortal(
    <div className="pricing-confirm-backdrop" onClick={confirming ? undefined : onClose}>
      <div
        className="pricing-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pricing-confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pricing-confirm-head">
          <div>
            <h2 id="pricing-confirm-title">
              <Crown size={18} />
              Xác nhận đăng ký gói
            </h2>
            <p>Bạn có chắc chắn muốn đăng ký gói này?</p>
          </div>
          <button
            type="button"
            className="pricing-confirm-close"
            aria-label="Đóng"
            onClick={onClose}
            disabled={confirming}
          >
            <X size={18} />
          </button>
        </div>

        <div className="pricing-confirm-body">
          <section className="pricing-confirm-summary">
            <div className="pricing-confirm-plan-row">
              <span className="pricing-confirm-label">Gói</span>
              <div className="pricing-confirm-plan-name">
                <strong>{plan.name}</strong>
                {saveLabel ? <span className="pricing-confirm-save">{saveLabel}</span> : null}
              </div>
            </div>

            <div className="pricing-confirm-plan-row">
              <span className="pricing-confirm-label">Giá</span>
              <strong className="pricing-confirm-price">{formatCurrencyVnd(plan.price)}</strong>
            </div>

            <p className="pricing-confirm-note warn">Gói của bạn sẽ không tự động gia hạn</p>

            <ul className="pricing-confirm-highlights">
              {highlights.map((item) => (
                <li key={item.label}>
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="pricing-confirm-details">
            <p className="pricing-confirm-note box">
              Hãy chắc chắn bạn muốn đăng ký gói này vì nó hỗ trợ các model bên dưới.
            </p>

            <div className="pricing-confirm-models">
              <p className="pricing-confirm-models-title">Models hỗ trợ ({models.length})</p>
              <div className="pricing-confirm-models-list">
                {models.map((model, idx) => {
                  const tags = modelTags(model);
                  return (
                    <article key={`${plan.id_base}-${model.model || model.name || idx}`} className="pricing-confirm-model">
                      <strong>{model.name || model.model || 'Unknown model'}</strong>
                      {tags.length > 0 ? (
                        <div className="pricing-confirm-model-tags">
                          {tags.map((tag) => (
                            <span key={`${model.model || model.name}-${tag}`}>{tag}</span>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
                {models.length === 0 ? <p className="muted">Không có model trong gói này.</p> : null}
              </div>
            </div>

            <p className="pricing-confirm-policy">
              Chính sách có thể thay đổi theo thời gian. Nếu gói không phù hợp, liên hệ hỗ trợ để được tư vấn hoàn
              tiền theo quy định.
            </p>

            <div className="pricing-confirm-support">
              <p>Hỗ trợ: 0965-393-325</p>
              <p>Cộng đồng: Zalo · Facebook · TikTok</p>
            </div>

            <label className="pricing-confirm-promo">
              <span>Mã khuyến mãi (nếu có)</span>
              <input
                value={promoCode}
                placeholder="Nhập mã khuyến mãi..."
                onChange={(e) => setPromoCode(e.target.value)}
                disabled={confirming}
              />
            </label>
          </section>
        </div>

        {error ? <p className="pricing-confirm-error">{error}</p> : null}

        <div className="pricing-confirm-actions">
          <button type="button" className="pricing-confirm-cancel" onClick={onClose} disabled={confirming}>
            Hủy
          </button>
          <button
            type="button"
            className="pricing-confirm-submit"
            onClick={() => onConfirm(promoCode.trim())}
            disabled={confirming}
          >
            {confirming ? <Loader2 size={16} className="spin" /> : null}
            {confirming ? 'Đang tạo link thanh toán...' : 'Xác nhận'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
