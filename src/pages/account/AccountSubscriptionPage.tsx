import { getCreditsAi, getUpstreamMe } from '../../services/authStore';
import { Link } from 'react-router-dom';

export default function AccountSubscriptionPage() {
  const me = getUpstreamMe();
  const credits = getCreditsAi();
  const active = me?.userInfo?.activate === 1;

  return (
    <div className="account-settings">
      <h1 className="account-content-title">👑 GÓI ĐĂNG KÝ</h1>
      <section className="panel account-card">
        <div className="account-detail-row-inline">
          <span>Trạng thái gói</span>
          <span className={`profile-plan-badge ${active ? 'active' : ''}`}>
            {active ? 'Active' : 'Free'}
          </span>
        </div>
        <div className="account-detail-row-inline">
          <span>Credits hiện tại</span>
          <strong>{credits.toLocaleString('vi-VN')}</strong>
        </div>
        <Link
          to="/pricing"
          className="btn primary profile-upgrade-btn"
          style={{ marginTop: '1rem' }}
        >
          UPGRADE TO PRO
        </Link>
      </section>
    </div>
  );
}
