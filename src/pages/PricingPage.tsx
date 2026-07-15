import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Loader2, Sparkles } from 'lucide-react';
import SubscriptionConfirmModal from '../components/SubscriptionConfirmModal';
import SubscriptionPaymentModal from '../components/SubscriptionPaymentModal';
import CreditConfirmModal from '../components/CreditConfirmModal';
import ModelCreditComparison from '../components/ModelCreditComparison';
import { getDisplayUser, notifyCreditsUpdated, refreshSession } from '../services/authStore';
import {
  createTopupRequest,
  fetchCreditPackages,
  fetchTopupOrder,
  type CreditPackage,
} from '../services/topupApi';
import {
  createSubscriptionPayment,
  fetchSubscriptionPlans,
  type SubscriptionPaymentResult,
  type SubscriptionPlan,
  type SubscriptionPlanType,
} from '../services/subscriptionPlans';

type PlanFieldKey =
  | 'video_day'
  | 'video_month'
  | 'video_vip_day'
  | 'video_vip_month'
  | 'image_day'
  | 'image_month'
  | 'image_vip_day'
  | 'image_vip_month'
  | 'concurrent'
  | 'concurrent_vip'
  | 'queue'
  | 'queue_vip'
  | 'storage';

type PricingTab = SubscriptionPlanType | 'credit';

interface ComparisonRow {
  label: string;
  field: PlanFieldKey;
}

const PLAN_TABS: Array<{ key: PricingTab; label: string; hint: string }> = [
  { key: 'combo', label: 'Combo', hint: 'Ảnh + video' },
  { key: 'image', label: 'Gói ảnh', hint: 'Image-first' },
  { key: 'video', label: 'Gói video', hint: 'Video-first' },
  { key: 'credit', label: 'Nạp Credit', hint: 'Thanh toán một lần' },
];

const COMPARISON_ROWS: ComparisonRow[] = [
  { label: 'Video/ngày', field: 'video_day' },
  { label: 'Video/tháng', field: 'video_month' },
  { label: 'Video VIP/ngày', field: 'video_vip_day' },
  { label: 'Video VIP/tháng', field: 'video_vip_month' },
  { label: 'Ảnh/ngày', field: 'image_day' },
  { label: 'Ảnh/tháng', field: 'image_month' },
  { label: 'Ảnh VIP/ngày', field: 'image_vip_day' },
  { label: 'Ảnh VIP/tháng', field: 'image_vip_month' },
  { label: 'Concurrent', field: 'concurrent' },
  { label: 'Concurrent VIP', field: 'concurrent_vip' },
  { label: 'Queue', field: 'queue' },
  { label: 'Queue VIP', field: 'queue_vip' },
  { label: 'Lưu trữ', field: 'storage' },
];

const TOOL_LABELS: Record<string, string> = {
  auto_mode_image: 'Auto mode image',
  auto_mode_video: 'Auto mode video',
  auto_mode_prompt: 'Auto mode prompt',
  auto_mode_audio: 'Auto mode audio',
  templates: 'Templates',
};

const FAQ_ITEMS = [
  {
    q: 'Credits hoạt động như thế nào?',
    a: 'Mỗi plan mở quyền truy cập model và hạn mức theo ngày/tháng. Khi chạy model tính theo credit, hệ thống sẽ trừ trực tiếp vào quota/credit của gói.',
  },
  {
    q: 'Gói có tự gia hạn không?',
    a: 'Tùy phương thức thanh toán trên cổng nạp. Bạn nên hiển thị trạng thái gia hạn ở trang tài khoản để người dùng kiểm soát.',
  },
  {
    q: 'Tôi có thể đổi gói sau khi mua?',
    a: 'Có. Bạn có thể xử lý theo rule nội bộ: nâng cấp thì cộng phần còn lại, hạ cấp thì áp dụng từ chu kỳ tiếp theo.',
  },
  {
    q: 'Các gói unlimited hoạt động ra sao?',
    a: 'Unlimited thường áp dụng cho quota chính (video/image) nhưng vẫn giới hạn concurrent, queue và loại model để giữ ổn định hạ tầng.',
  },
];

function formatCurrencyVnd(value?: string): string {
  if (!value) return 'Liên hệ';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  return `${amount.toLocaleString('vi-VN')}đ`;
}

function parsePrice(value?: string): number {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function normalizeFieldValue(value?: string): string {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '0';
  if (/^unlimited$/i.test(trimmed)) return 'Unlimited';
  return trimmed;
}

function planTools(plan: SubscriptionPlan): string[] {
  return (plan.tools || []).map((tool) => TOOL_LABELS[tool] || tool);
}

function isFeaturedPlan(plan: SubscriptionPlan): boolean {
  const key = (plan.plan_key || '').toLowerCase();
  const name = (plan.name || '').toLowerCase();
  return key.includes('starter') || key.includes('combo') || name.includes('starter');
}

export default function PricingPage() {
  const [tab, setTab] = useState<PricingTab>('credit');
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [creditPackages, setCreditPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payingPlanId, setPayingPlanId] = useState('');
  const [payError, setPayError] = useState('');
  const [confirmPlan, setConfirmPlan] = useState<SubscriptionPlan | null>(null);
  const [paymentPlanName, setPaymentPlanName] = useState('');
  const [paymentPlanPrice, setPaymentPlanPrice] = useState('');
  const [paymentResult, setPaymentResult] = useState<SubscriptionPaymentResult | null>(null);
  const [confirmCreditPackage, setConfirmCreditPackage] = useState<CreditPackage | null>(null);
  const [creditOrderCode, setCreditOrderCode] = useState<number | null>(null);
  const [creditOrderStatus, setCreditOrderStatus] = useState('');
  const [openFaq, setOpenFaq] = useState(0);
  const username = getDisplayUser().username || '';

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setPayError('');
    setPayingPlanId('');
    setConfirmPlan(null);
    setConfirmCreditPackage(null);
    setPaymentResult(null);
    setPaymentPlanName('');
    setPaymentPlanPrice('');

    if (tab === 'credit') {
      fetchCreditPackages()
        .then((rows) => {
          if (active) setCreditPackages(rows);
        })
        .catch((err) => {
          if (!active) return;
          setCreditPackages([]);
          setError(err instanceof Error ? err.message : String(err));
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
      };
    }

    fetchSubscriptionPlans(tab)
      .then((rows) => {
        if (!active) return;
        const list = [...rows].sort((a, b) => parsePrice(a.price) - parsePrice(b.price));
        setPlans(list);
      })
      .catch((err) => {
        if (!active) return;
        setPlans([]);
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [tab]);

  useEffect(() => {
    if (!creditOrderCode) return;
    let stopped = false;

    const poll = async () => {
      if (stopped) return;
      try {
        const order = await fetchTopupOrder(creditOrderCode);
        if (stopped) return;
        setCreditOrderStatus(order.status);
        if (order.status === 'credited') {
          await refreshSession();
          notifyCreditsUpdated();
          return;
        }
        if (order.status === 'failed') {
          setPayError(order.error || 'Nạp credit thất bại');
          return;
        }
      } catch {
        // Lỗi mạng tạm thời: tiếp tục kiểm tra đơn.
      }
      if (!stopped) window.setTimeout(poll, 3000);
    };

    void poll();
    return () => {
      stopped = true;
    };
  }, [creditOrderCode]);

  const allToolRows = useMemo(() => {
    const set = new Set<string>();
    for (const plan of plans) {
      for (const tool of planTools(plan)) set.add(tool);
    }
    return [...set];
  }, [plans]);

  function openSubscribeModal(plan: SubscriptionPlan): void {
    if (!plan.id_base) {
      setPayError('Không tìm thấy plan_id cho gói này.');
      return;
    }
    setPayError('');
    setConfirmPlan(plan);
  }

  function closeSubscribeModal(): void {
    if (payingPlanId) return;
    setConfirmPlan(null);
    setPayError('');
  }

  function closePaymentModal(): void {
    setPaymentResult(null);
    setPaymentPlanName('');
    setPaymentPlanPrice('');
    setPayingPlanId('');
    setPayError('');
    setCreditOrderCode(null);
    setCreditOrderStatus('');
  }

  function openCreditModal(creditPackage: CreditPackage): void {
    setPayError('');
    setConfirmCreditPackage(creditPackage);
  }

  function closeCreditModal(): void {
    if (payingPlanId) return;
    setConfirmCreditPackage(null);
    setPayError('');
  }

  async function handleConfirmCredit(): Promise<void> {
    if (!confirmCreditPackage) return;
    if (!username) {
      setPayError('Tài khoản chưa có username — không thể nạp credit.');
      return;
    }

    setPayError('');
    setPayingPlanId(confirmCreditPackage.id);
    try {
      const topup = await createTopupRequest(username, confirmCreditPackage.id);
      setPaymentPlanName(`${confirmCreditPackage.name} · ${topup.credits.toLocaleString('vi-VN')} Credits`);
      setPaymentPlanPrice(String(confirmCreditPackage.amountVnd));
      setPaymentResult({
        status: topup.status,
        url: topup.url,
        urlEmbedded: topup.urlEmbedded,
        qrImage: topup.qrImage,
        bankTransfer: topup.bankTransfer,
      });
      setCreditOrderCode(topup.orderCode);
      setCreditOrderStatus('pending');
      setConfirmCreditPackage(null);
    } catch (err) {
      setPayError(err instanceof Error ? err.message : String(err));
    } finally {
      setPayingPlanId('');
    }
  }

  async function handleConfirmSubscribe(_promoCode: string): Promise<void> {
    if (!confirmPlan?.id_base) {
      setPayError('Không tìm thấy plan_id cho gói này.');
      return;
    }
    setPayError('');
    setPayingPlanId(confirmPlan.id_base);
    try {
      const payment = await createSubscriptionPayment({
        planId: confirmPlan.id_base,
        planName: confirmPlan.name,
        amount: confirmPlan.price,
        gateway: 'payos',
      });
      setPaymentPlanName(confirmPlan.name);
      setPaymentPlanPrice(confirmPlan.price);
      setPaymentResult(payment);
      setConfirmPlan(null);
      setPayingPlanId('');
    } catch (err) {
      setPayError(err instanceof Error ? err.message : String(err));
      setPayingPlanId('');
    }
  }

  return (
    <div className="page pricing-page-v2">
      <section className="pricing-hero panel">
        <p className="kicker">Pricing</p>
        <h1>Bảng giá gói đăng ký</h1>
        <p className="lead">
          Chọn đúng gói theo nhu cầu tạo ảnh/video. Dữ liệu tải trực tiếp từ endpoint plans theo từng tab.
        </p>
      </section>

      <section className="pricing-tabs" aria-label="Pricing tabs">
        {PLAN_TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`pricing-tab-btn ${tab === item.key ? 'active' : ''}`}
            onClick={() => setTab(item.key)}
          >
            <strong>{item.label}</strong>
            <span>{item.hint}</span>
          </button>
        ))}
      </section>

      {loading && (
        <div className="pricing-loading">
          <Loader2 size={16} className="spin" />
          <span>Đang tải gói...</span>
        </div>
      )}
      {!loading && error && <p className="error pricing-error">{error}</p>}
      {!!payError && !confirmPlan && !confirmCreditPackage && (
        <div className="banner warn pricing-pay-error">{payError}</div>
      )}

      {!loading && !error && (
        tab === 'credit' ? (
          <section className="pricing-credit-section">
            <div className="pricing-credit-expiry">
              <span>☆</span>
              <strong>Lưu ý: Credit nạp sẽ hết hạn sau 3 tháng kể từ ngày nạp.</strong>
            </div>

            <div className="pricing-credit-list">
              {creditPackages.map((creditPackage) => {
                const rate = Math.round((creditPackage.credits / creditPackage.amountVnd) * 1000);
                return (
                  <article
                    key={creditPackage.id}
                    className={`pricing-credit-card${creditPackage.featured ? ' featured' : ''}`}
                  >
                    <div className="pricing-credit-info">
                      <div className="pricing-credit-title-row">
                        <h2>{creditPackage.credits.toLocaleString('vi-VN')} Credits</h2>
                        {creditPackage.featured ? <span className="pricing-credit-best">BEST</span> : null}
                        <span className="pricing-credit-rate">
                          ≈ {rate.toLocaleString('vi-VN')} credit / 1.000đ
                        </span>
                        {creditPackage.bonusPercent > 0 ? (
                          <span className="pricing-credit-bonus">+{creditPackage.bonusPercent}% Thưởng</span>
                        ) : null}
                      </div>

                      <p className="pricing-credit-name">{creditPackage.name}</p>
                      <ul className="pricing-credit-notes">
                        <li>Dùng cho tạo ảnh, video, TTS, nhạc và các model trả phí</li>
                        {creditPackage.bonusPercent > 0 ? (
                          <li>+{creditPackage.bonusPercent}% credits thưởng so với mệnh giá cơ bản</li>
                        ) : null}
                        {creditPackage.prioritySupport ? <li>Hỗ trợ ưu tiên</li> : null}
                      </ul>
                    </div>

                    <div className="pricing-credit-buy">
                      <div className="pricing-credit-price">
                        {creditPackage.credits > creditPackage.amountVnd ? (
                          <span>{creditPackage.credits.toLocaleString('vi-VN')}đ</span>
                        ) : null}
                        <strong>{creditPackage.amountVnd.toLocaleString('vi-VN')}đ</strong>
                      </div>
                      <small>Thanh toán 1 lần</small>
                      <button
                        type="button"
                        className="pricing-credit-buy-btn"
                        onClick={() => openCreditModal(creditPackage)}
                        disabled={!!payingPlanId || !!confirmCreditPackage || !!paymentResult}
                      >
                        Mua ngay
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            <ModelCreditComparison creditPackages={creditPackages} />
          </section>
        ) : (
        <>
          <section className="pricing-cards-grid">
            {plans.map((plan) => {
              const models = plan.models || [];
              const tools = planTools(plan);

              return (
                <article
                  key={plan.id_base || plan.plan_key}
                  className={`panel pricing-plan-card ${isFeaturedPlan(plan) ? 'featured' : ''}`}
                >
                  <div className="pricing-plan-top">
                    <div>
                      <h2>{plan.name}</h2>
                      <p className="muted">{plan.group || 'Gói tiêu chuẩn'}</p>
                    </div>
                    {plan.save_percent ? <span className="pricing-save-badge">-{plan.save_percent}</span> : null}
                  </div>

                  <div className="pricing-price-wrap">
                    <strong>{formatCurrencyVnd(plan.price)}</strong>
                    {plan.price_regular ? (
                      <span className="pricing-price-old">{formatCurrencyVnd(plan.price_regular)}</span>
                    ) : null}
                  </div>

                  <ul className="pricing-main-stats">
                    <li>
                      <span>Video/tháng</span>
                      <strong>{normalizeFieldValue(plan.video_month)}</strong>
                    </li>
                    <li>
                      <span>Ảnh/tháng</span>
                      <strong>{normalizeFieldValue(plan.image_month)}</strong>
                    </li>
                    <li>
                      <span>Concurrent</span>
                      <strong>{normalizeFieldValue(plan.concurrent)}</strong>
                    </li>
                    <li>
                      <span>Queue</span>
                      <strong>{normalizeFieldValue(plan.queue)}</strong>
                    </li>
                    <li>
                      <span>Lưu trữ</span>
                      <strong>{normalizeFieldValue(plan.storage)}</strong>
                    </li>
                  </ul>

                  <div className="pricing-models">
                    <p className="pricing-models-title">Models ({models.length})</p>
                    <div className="pricing-chip-list">
                      {models.slice(0, 8).map((model, idx) => (
                        <span key={`${plan.id_base}-${model.model || model.name || idx}`} className="pricing-chip">
                          {model.name || model.model || 'Unknown model'}
                        </span>
                      ))}
                      {models.length > 8 ? (
                        <span className="pricing-chip muted">+{models.length - 8} model</span>
                      ) : null}
                    </div>
                  </div>

                  {tools.length > 0 ? (
                    <div className="pricing-tools">
                      <p className="pricing-models-title">Tools</p>
                      <div className="pricing-chip-list">
                        {tools.map((tool) => (
                          <span key={`${plan.id_base}-${tool}`} className="pricing-chip tool">
                            {tool}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    className="btn primary pricing-cta-btn"
                    onClick={() => openSubscribeModal(plan)}
                    disabled={!!payingPlanId || !!confirmPlan || !!paymentResult}
                  >
                    {payingPlanId === plan.id_base ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
                    {payingPlanId === plan.id_base ? 'Đang tạo link thanh toán...' : 'Đăng ký ngay'}
                  </button>
                </article>
              );
            })}
          </section>

          <section className="panel pricing-compare">
            <div className="panel-head">
              <h2>Bảng so sánh</h2>
              <span className="muted">Dữ liệu theo tab {tab}</span>
            </div>
            {plans.length === 0 ? (
              <p className="muted">Không có plan ở tab này.</p>
            ) : (
              <div className="pricing-table-wrap">
                <table className="data-table pricing-table">
                  <thead>
                    <tr>
                      <th>Tính năng</th>
                      {plans.map((plan) => (
                        <th key={`head-${plan.id_base}`}>{plan.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARISON_ROWS.map((row) => (
                      <tr key={row.field}>
                        <td>{row.label}</td>
                        {plans.map((plan) => (
                          <td key={`${plan.id_base}-${row.field}`}>{normalizeFieldValue(plan[row.field])}</td>
                        ))}
                      </tr>
                    ))}
                    {allToolRows.map((tool) => (
                      <tr key={`tool-${tool}`}>
                        <td>{tool}</td>
                        {plans.map((plan) => (
                          <td key={`${plan.id_base}-${tool}`}>
                            {planTools(plan).includes(tool) ? (
                              <span className="pricing-check">
                                <Check size={14} />
                                Có
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="pricing-reasons">
            <h2>Tại sao chọn chúng tôi?</h2>
            <div className="pricing-reasons-grid">
              <article className="panel">
                <h3>Thanh toán bảo mật</h3>
                <p className="muted">Hỗ trợ nhiều phương thức, dữ liệu giao dịch được mã hóa.</p>
              </article>
              <article className="panel">
                <h3>Hỗ trợ 24/7</h3>
                <p className="muted">Đội ngũ hỗ trợ liên tục, xử lý nhanh vấn đề gói và thanh toán.</p>
              </article>
              <article className="panel">
                <h3>Hiệu năng cao</h3>
                <p className="muted">Phân bổ queue/concurrent rõ ràng theo từng plan để chạy ổn định.</p>
              </article>
            </div>
          </section>

          <section className="panel pricing-faq">
            <h2>Câu hỏi thường gặp</h2>
            <div className="pricing-faq-list">
              {FAQ_ITEMS.map((item, idx) => {
                const opened = openFaq === idx;
                return (
                  <button
                    key={item.q}
                    type="button"
                    className={`pricing-faq-item ${opened ? 'open' : ''}`}
                    onClick={() => setOpenFaq(opened ? -1 : idx)}
                  >
                    <span>{item.q}</span>
                    <ChevronDown size={16} />
                    {opened ? <p>{item.a}</p> : null}
                  </button>
                );
              })}
            </div>
          </section>
        </>
        )
      )}

      <SubscriptionConfirmModal
        open={!!confirmPlan}
        plan={confirmPlan}
        confirming={!!payingPlanId}
        error={payError}
        onClose={closeSubscribeModal}
        onConfirm={(promoCode) => void handleConfirmSubscribe(promoCode)}
      />

      <CreditConfirmModal
        open={!!confirmCreditPackage}
        creditPackage={confirmCreditPackage}
        confirming={!!payingPlanId}
        error={payError}
        onClose={closeCreditModal}
        onConfirm={() => void handleConfirmCredit()}
      />

      <SubscriptionPaymentModal
        open={!!paymentResult}
        planName={paymentPlanName}
        planPrice={paymentPlanPrice}
        payment={paymentResult}
        statusMessage={
          creditOrderStatus === 'credited'
            ? 'Thanh toán thành công — credit đã được cộng vào tài khoản.'
            : creditOrderCode
              ? 'Đang chờ xác nhận thanh toán…'
              : undefined
        }
        onClose={closePaymentModal}
      />
    </div>
  );
}
