import { FormEvent, useState } from 'react';
import { AlertTriangle, ArrowLeftRight, Coins, MessageSquare, User } from 'lucide-react';
import { notifyCreditsUpdated, refreshSession } from '../../services/authStore';
import {
  MAX_TRANSFER_CREDIT,
  MIN_TRANSFER_CREDIT,
  sendBalances,
} from '../../services/transferBalances';

const SAFETY_RULES = [
  'Giao dịch chuyển credit không thể hoàn tác sau khi thành công.',
  'Kiểm tra kỹ username người nhận để tránh chuyển nhầm.',
  'Không chuyển tiền cho người lạ hoặc theo yêu cầu từ nguồn không đáng tin.',
  `Hạn mức tối thiểu ${MIN_TRANSFER_CREDIT.toLocaleString('vi-VN')} và tối đa ${MAX_TRANSFER_CREDIT.toLocaleString('vi-VN')} credit mỗi lần.`,
] as const;

export default function AccountTransferPage() {
  const [username, setUsername] = useState('');
  const [value, setValue] = useState('10000');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const result = await sendBalances({
        username,
        value: Number(value),
        message,
      });
      await refreshSession();
      notifyCreditsUpdated();
      setSuccess(result.message || 'Chuyển credit thành công');
      setUsername('');
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

      <div className="account-transfer-grid">
        <section className="panel account-card account-transfer-form-card">
          <form className="form account-form account-transfer-form" onSubmit={handleSubmit}>
            <label className="field">
              <span className="label">
                <User size={14} aria-hidden />
                USERNAME NGƯỜI NHẬN
              </span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nhập username hoặc số điện thoại"
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
                min={MIN_TRANSFER_CREDIT}
                max={MAX_TRANSFER_CREDIT}
                step={1000}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={String(MIN_TRANSFER_CREDIT)}
                disabled={loading}
              />
              <p className="account-transfer-limits">
                Min: {MIN_TRANSFER_CREDIT.toLocaleString('vi-VN')} · Max:{' '}
                {MAX_TRANSFER_CREDIT.toLocaleString('vi-VN')}
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
              {loading ? 'Đang chuyển…' : 'CHUYỂN NGAY'}
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
