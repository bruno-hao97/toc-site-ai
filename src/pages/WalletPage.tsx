import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchGommoDashboardStats } from '../services/gommoDashboard';
import type { CreditTransaction } from '../services/dashboardTypes';
import {
  fetchAdminWalletStats,
  type AdminWalletStats,
} from '../services/adminWalletStats';
import { syncAdminInternalFund } from '../services/adminSyncFund';
import { useDisplayCredits } from '../hooks/useDisplayCredits';

const TX_LABELS: Record<string, string> = {
  signup_bonus: 'Bonus đăng ký',
  job_charge: 'Trừ job',
  job_refund: 'Hoàn credit',
  topup: 'Nạp tiền',
  promotion: 'Khuyến mãi',
};

const TRANSFER_KIND_LABELS: Record<string, string> = {
  admin_grant: 'Cấp cho user',
  transfer: 'Chuyển từ ví',
  topup_sale: 'User nạp',
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function formatNum(n: number) {
  return n.toLocaleString('vi-VN');
}

export default function WalletPage() {
  const {
    credits: displayBalance,
    platformCredits,
    isAdminVmedia,
    refresh: refreshDisplay,
  } = useDisplayCredits();
  const [balance, setBalance] = useState(displayBalance);
  const [internalBalance, setInternalBalance] = useState(platformCredits);
  const [consumed, setConsumed] = useState(0);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [adminStats, setAdminStats] = useState<AdminWalletStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [syncOk, setSyncOk] = useState('');

  useEffect(() => {
    setBalance(displayBalance);
    setInternalBalance(platformCredits);
  }, [displayBalance, platformCredits]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [display, stats] = await Promise.all([
        refreshDisplay(),
        fetchGommoDashboardStats('all'),
      ]);
      setBalance(display.credits);
      setInternalBalance(display.platformCredits);
      setConsumed(stats.credits.consumed_net);
      setTransactions(stats.recent_transactions);

      if (display.isAdminVmedia) {
        try {
          const wallet = await fetchAdminWalletStats();
          setAdminStats(wallet);
          if (wallet) {
            setInternalBalance(wallet.platform_credits);
            if (wallet.vmedia_credits != null) setBalance(wallet.vmedia_credits);
          }
        } catch (walletErr) {
          setAdminStats(null);
          setError(
            walletErr instanceof Error
              ? `Số dư đã tải; thống kê ví: ${walletErr.message}`
              : 'Không tải được thống kê ví admin',
          );
        }
      } else {
        setAdminStats(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [refreshDisplay]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSyncFund() {
    const vmedia = adminStats?.vmedia_credits ?? balance;
    const users = adminStats?.users_credits ?? 0;
    const target = Math.max(0, vmedia - users);
    const ok = window.confirm(
      [
        'Đồng bộ ví nội bộ?',
        `Pro.agi.vn: ${formatNum(vmedia)}`,
        `Credit user: ${formatNum(users)}`,
        `Ví nội bộ sau đồng bộ: ${formatNum(target)}`,
        `Ví nội bộ hiện tại: ${formatNum(internalBalance)}`,
      ].join('\n'),
    );
    if (!ok) return;

    setSyncing(true);
    setError('');
    setSyncOk('');
    try {
      const result = await syncAdminInternalFund();
      setSyncOk(
        `Đã đồng bộ: ${formatNum(result.platform_credits_before)} → ${formatNum(result.platform_credits)}`,
      );
      setInternalBalance(result.platform_credits);
      setBalance(result.vmedia_credits);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  }

  const reconcileBad = adminStats?.reconcile_ok === false;
  const delta = adminStats?.reconcile_delta;

  return (
    <div className="page wallet-page">
      <div className="page-head">
        <p className="kicker">Ví credit</p>
        <h1>Ví credit</h1>
        {!isAdminVmedia && (
          <p className="lead">
            Số dư: <strong>{formatNum(balance)}</strong>
            <> · Đã tiêu: <strong>{formatNum(consumed)}</strong></>
          </p>
        )}
      </div>

      {loading && <p className="muted">Đang tải…</p>}
      {error && <p className="error">{error}</p>}
      {syncOk && <p className="success">{syncOk}</p>}

      {isAdminVmedia && reconcileBad && (
        <div className="wallet-reconcile-alert" role="alert">
          Lệch đối soát: {formatNum(Math.abs(delta ?? 0))}
          {' · '}
          Pro.agi.vn {formatNum(adminStats?.vmedia_credits ?? 0)}
          {' / '}
          Σ platform {formatNum(adminStats?.sum_platform_credits ?? 0)}
        </div>
      )}

      {isAdminVmedia && (
        <div className="wallet-admin-kpis">
          <section className="panel wallet-kpi-card">
            <p className="wallet-kpi-label">Ví nội bộ</p>
            <p className="wallet-kpi-value">{formatNum(internalBalance)}</p>
          </section>
          <section className="panel wallet-kpi-card">
            <p className="wallet-kpi-label">Pro.agi.vn</p>
            <p className="wallet-kpi-value wallet-kpi-value--teal">{formatNum(balance)}</p>
          </section>
          <section className="panel wallet-kpi-card">
            <p className="wallet-kpi-label">Credit user</p>
            <p className="wallet-kpi-value">{formatNum(adminStats?.users_credits ?? 0)}</p>
          </section>
          <section className="panel wallet-kpi-card">
            <p className="wallet-kpi-label">Σ ví platform</p>
            <p className="wallet-kpi-value">{formatNum(adminStats?.sum_platform_credits ?? 0)}</p>
          </section>
          <section className="panel wallet-kpi-card">
            <p className="wallet-kpi-label">Lệch đối soát</p>
            <p className={`wallet-kpi-value${reconcileBad ? ' wallet-kpi-value--warn' : ''}`}>
              {delta == null ? '—' : formatNum(delta)}
            </p>
          </section>
          <section className="panel wallet-kpi-card">
            <p className="wallet-kpi-label">Đã cấp</p>
            <p className="wallet-kpi-value">{formatNum(adminStats?.transferred_grant ?? 0)}</p>
          </section>
          <section className="panel wallet-kpi-card">
            <p className="wallet-kpi-label">Đã topup</p>
            <p className="wallet-kpi-value">{formatNum(adminStats?.transferred_topup ?? 0)}</p>
          </section>
          <section className="panel wallet-kpi-card">
            <p className="wallet-kpi-label">Đã chuyển</p>
            <p className="wallet-kpi-value">{formatNum(adminStats?.transferred_transfer ?? 0)}</p>
          </section>
          <section className="panel wallet-kpi-card">
            <p className="wallet-kpi-label">Tự dùng</p>
            <p className="wallet-kpi-value">{formatNum(adminStats?.self_used ?? 0)}</p>
          </section>
          <section className="panel wallet-kpi-card">
            <p className="wallet-kpi-label">Đang treo</p>
            <p className="wallet-kpi-value">{formatNum(adminStats?.in_flight_all ?? 0)}</p>
          </section>
          <section className="panel wallet-kpi-card">
            <p className="wallet-kpi-label">Đã hoàn fail</p>
            <p className="wallet-kpi-value">{formatNum(adminStats?.refunded_total ?? 0)}</p>
          </section>
          <section className="panel wallet-kpi-card">
            <p className="wallet-kpi-label">Quỹ admin</p>
            <p className="wallet-kpi-value">{formatNum(adminStats?.implied_admin_fund ?? 0)}</p>
          </section>
        </div>
      )}

      {isAdminVmedia && (
        <div className="wallet-admin-actions">
          <button
            type="button"
            className="btn primary sm"
            disabled={syncing}
            onClick={() => void handleSyncFund()}
          >
            {syncing ? 'Đang đồng bộ…' : 'Đồng bộ quỹ nội bộ'}
          </button>
          <Link to="/account/transfer" className="btn ghost sm">Chuyển / cấp credit</Link>
        </div>
      )}

      <div className="tables-grid wallet-tables">
        {isAdminVmedia && (
          <section className="panel">
            <div className="panel-head">
              <h2>Lịch sử cấp / chuyển / topup</h2>
              <Link to="/account/transfer" className="btn ghost sm">Chuyển tiền →</Link>
            </div>
            {!adminStats?.recent_transfers?.length ? (
              <p className="muted">Chưa có giao dịch.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Loại</th>
                    <th>Số tiền</th>
                    <th>Người nhận</th>
                    <th>Lời nhắn</th>
                    <th>Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {adminStats.recent_transfers.map((t) => (
                    <tr key={t.id}>
                      <td>{TRANSFER_KIND_LABELS[t.kind] || t.kind}</td>
                      <td className="amount-minus">−{formatNum(t.amount)}</td>
                      <td>{t.to_email || t.to_name || '—'}</td>
                      <td className="muted-cell">{t.message || '—'}</td>
                      <td>{formatDate(t.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}

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
                      {t.amount >= 0 ? '+' : ''}{formatNum(t.amount)}
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
