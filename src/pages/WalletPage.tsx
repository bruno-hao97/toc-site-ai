import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchGommoDashboardStats } from '../services/gommoDashboard';
import type { CreditTransaction } from '../services/dashboardTypes';
import { getCreditsAi } from '../services/authStore';

const TX_LABELS: Record<string, string> = {
  signup_bonus: 'Bonus đăng ký',
  job_charge: 'Trừ job',
  job_refund: 'Hoàn credit',
  topup: 'Nạp tiền',
  promotion: 'Khuyến mãi',
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export default function WalletPage() {
  const [balance, setBalance] = useState(getCreditsAi());
  const [consumed, setConsumed] = useState(0);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const stats = await fetchGommoDashboardStats('all');
      setBalance(stats.balance);
      setConsumed(stats.credits.consumed_net);
      setTransactions(stats.recent_transactions);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="page wallet-page">
      <div className="page-head">
        <p className="kicker">Ví credit</p>
        <h1>Ví credit</h1>
        <p className="lead">
          Số dư: <strong>{balance} credit</strong>
          <> · Đã tiêu: <strong>{consumed} credit</strong></>
        </p>
      </div>

      <div className="banner warn">
        Số dư &amp; lịch sử chi tiêu lấy trực tiếp từ Gommo. Nạp credit thực hiện trên hệ thống Gommo.
      </div>

      {loading && <p className="muted">Đang tải…</p>}
      {error && <p className="error">{error}</p>}

      <div className="tables-grid wallet-tables">
        <section className="panel">
          <div className="panel-head">
            <h2>Lịch sử chi tiêu</h2>
            <Link to="/dashboard" className="btn ghost sm">Dashboard →</Link>
          </div>
          {transactions.length === 0 ? (
            <p className="muted">Chưa có giao dịch.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Loại</th>
                  <th>Số tiền</th>
                  <th>Mô tả</th>
                  <th>Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td>{TX_LABELS[t.type] || t.type}</td>
                    <td className={t.amount >= 0 ? 'amount-plus' : 'amount-minus'}>
                      {t.amount >= 0 ? '+' : ''}{t.amount}
                    </td>
                    <td className="muted-cell">{t.description || '—'}</td>
                    <td>{formatDate(t.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
