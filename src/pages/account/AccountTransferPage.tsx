import { FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeftRight, Coins, MessageSquare, User } from 'lucide-react';
import {
  getPlatformCredits,
  loadAuth,
  loginWithPlatformSession,
  notifyCreditsUpdated,
  refreshSession,
} from '../../services/authStore';
import { useDisplayCredits } from '../../hooks/useDisplayCredits';
import {
  grantPlatformCredits,
  MAX_TRANSFER_CREDIT,
  MIN_TRANSFER_CREDIT,
  transferPlatformCredits,
} from '../../services/transferBalances';

const SAFETY_RULES = [
  'Giao dịch chuyển credit không thể hoàn tác sau khi thành công.',
  'Kiểm tra kỹ email / SĐT người nhận (tài khoản trên hệ thống của bạn).',
  'Không chuyển credit cho người lạ hoặc theo yêu cầu từ nguồn không đáng tin.',
  `Chuyển từ ví: tối thiểu ${MIN_TRANSFER_CREDIT.toLocaleString('vi-VN')} · tối đa ${MAX_TRANSFER_CREDIT.toLocaleString('vi-VN')} credit.`,
  'Admin: cấp credit cũng trừ ví nội bộ — kiểm tra số dư nội bộ trước khi cấp.',
] as const;

export default function AccountTransferPage() {
  const auth = loadAuth();
  const isAdmin = Boolean(auth?.user?.isAdmin);
  const { credits: vmediaCredits, platformCredits, isAdminVmedia, refresh } = useDisplayCredits();
  const [mode, setMode] = useState<'transfer' | 'grant'>(isAdmin ? 'grant' : 'transfer');
  const [to, setTo] = useState('');
  const [value, setValue] = useState(isAdmin ? '10000' : '1000');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const minAmount = mode === 'grant' ? 1 : MIN_TRANSFER_CREDIT;
  const balance = useMemo(
    () => (isAdmin ? platformCredits : getPlatformCredits()),
    [success, loading, isAdmin, platformCredits],
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const input = { to, value: Number(value), message };
      const result =
        mode === 'grant'
          ? await grantPlatformCredits(input)
          : await transferPlatformCredits(input);

      const session = await refreshSession();
      if (session.platform_token && session.user) {
        await loginWithPlatformSession(session.platform_token, session.user);
      }
      notifyCreditsUpdated();
      await refresh();
      setSuccess(
        `${result.message}: ${result.amount.toLocaleString('vi-VN')} credit → ${result.to?.email || to}`,
      );
      setTo('');
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="account-settings">
      <h1 className="account-content-title">↔ CHUYỂN TIỀN</h1>
      {isAdminVmedia ? (
        <div className="account-transfer-balances">
          <p>
            Ví nội bộ: <strong>{balance.toLocaleString('vi-VN')}</strong>
            <span className="muted"> · dùng để cấp/chuyển cho user</span>
          </p>
          <p>
            Pro.agi.vn: <strong>{vmediaCredits.toLocaleString('vi-VN')}</strong>
            <span className="muted"> · số dư merchant</span>
          </p>
          <p className="muted">
            <Link to="/wallet">Xem sổ ví →</Link>
          </p>
        </div>
      ) : (
        <p className="muted" style={{ marginBottom: '1rem' }}>
          Số dư của bạn: <strong>{balance.toLocaleString('vi-VN')}</strong> credit
        </p>
      )}

      <div className="account-transfer-grid">
        <section className="panel account-card account-transfer-form-card">
          {isAdmin ? (
            <div className="form" style={{ marginBottom: '0.75rem', display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className={`btn ${mode === 'grant' ? 'primary' : ''}`}
                onClick={() => setMode('grant')}
                disabled={loading}
              >
                Cấp từ ví nội bộ
              </button>
              <button
                type="button"
                className={`btn ${mode === 'transfer' ? 'primary' : ''}`}
                onClick={() => setMode('transfer')}
                disabled={loading}
              >
                Chuyển từ ví của tôi
              </button>
            </div>
          ) : null}

          <form className="form account-form account-transfer-form" onSubmit={handleSubmit}>
            <label className="field">
              <span className="label">
                <User size={14} aria-hidden />
                EMAIL / SĐT NGƯỜI NHẬN
              </span>
              <input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="email, SĐT, hoặc tên (vd: user2 / user2@email.com)"
                autoComplete="off"
                disabled={loading}
              />
            </label>

            <label className="field">
              <span className="label">
                <Coins size={14} aria-hidden />
                SỐ LƯỢNG CREDIT
              </span>
              <input
                type="number"
                min={minAmount}
                max={MAX_TRANSFER_CREDIT}
                step={1000}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={String(minAmount)}
                disabled={loading}
              />
              <p className="account-transfer-limits">
                {mode === 'grant'
                  ? `Trừ ví nội bộ · tối thiểu 1 · tối đa ${MAX_TRANSFER_CREDIT.toLocaleString('vi-VN')}`
                  : `Min: ${MIN_TRANSFER_CREDIT.toLocaleString('vi-VN')} · Max: ${MAX_TRANSFER_CREDIT.toLocaleString('vi-VN')}`}
              </p>
            </label>

            <label className="field">
              <span className="label">
                <MessageSquare size={14} aria-hidden />
                LỜI NHẮN (BẮT BUỘC)
              </span>
              <textarea
                className="account-transfer-message"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Nhập lời nhắn cho người nhận..."
                disabled={loading}
              />
            </label>

            {error ? <p className="account-transfer-feedback error">{error}</p> : null}
            {success ? <p className="account-transfer-feedback success">{success}</p> : null}

            <button type="submit" className="btn account-transfer-submit" disabled={loading}>
              <ArrowLeftRight size={16} aria-hidden />
              {loading ? 'Đang xử lý…' : mode === 'grant' ? 'CẤP CREDIT' : 'CHUYỂN NGAY'}
            </button>
          </form>
        </section>

        <aside className="account-transfer-warnings panel">
          <h2>
            <AlertTriangle size={16} aria-hidden />
            CẢNH BÁO AN TOÀN &amp; QUY TẮC
          </h2>
          <ul>
            {SAFETY_RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          <p className="account-transfer-warnings-foot">
            Việc tiếp tục đồng nghĩa với việc bạn đã hiểu các quy tắc an toàn.
          </p>
        </aside>
      </div>
    </div>
  );
}
