import { Link } from 'react-router-dom';

export default function AccountTransactionsPage() {
  return (
    <div className="account-settings">
      <h1 className="account-content-title">🕐 LỊCH SỬ GIAO DỊCH</h1>
      <section className="panel account-card">
        <p className="muted">
          Lịch sử nạp tiền và giao dịch credit trên trungtamai.vn.
        </p>
        <Link to="/usage-history" className="btn secondary sm">
          Xem lịch sử sử dụng →
        </Link>
        <p className="muted" style={{ marginTop: '1rem' }}>
          Chi tiết giao dịch tài chính sẽ hiển thị khi tích hợp API wallets/payments.
        </p>
      </section>
    </div>
  );
}
