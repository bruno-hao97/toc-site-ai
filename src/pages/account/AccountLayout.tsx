import { NavLink, Outlet } from 'react-router-dom';
import { getDisplayUser, isAdminUser } from '../../services/authStore';

type NavItem = {
  to: string;
  icon: string;
  label: string;
  end?: boolean;
};

type NavGroup = {
  section: string;
  items: NavItem[];
};

const NAV: NavGroup[] = [
  {
    section: 'CÀI ĐẶT TÀI KHOẢN',
    items: [
      { to: '/account', end: true, icon: '👤', label: 'Tài khoản' },
      { to: '/account/promo', icon: '🎁', label: 'Mã khuyến mãi' },
    ],
  },
  {
    section: 'GÓI CƯỚC CỦA BẠN',
    items: [
      { to: '/account/subscription', icon: '👑', label: 'Gói đăng ký' },
    ],
  },
  {
    section: 'TÀI CHÍNH',
    items: [
      { to: '/account/transactions', icon: '🕐', label: 'Lịch sử giao dịch' },
    ],
  },
];

const ADMIN_NAV: NavGroup = {
  section: 'QUẢN TRỊ',
  items: [{ to: '/account/transfer', icon: '↔', label: 'Cấp credit' }],
};

export default function AccountLayout() {
  const user = getDisplayUser();
  const navGroups = isAdminUser() ? [...NAV.slice(0, 2), ADMIN_NAV, ...NAV.slice(2)] : NAV;

  return (
    <div className="page account-page">
      <aside className="account-sidebar panel">
        <div className="account-sidebar-user">
          {user.avatar ? (
            <img src={user.avatar} alt="" className="account-sidebar-avatar" />
          ) : (
            <span className="account-sidebar-avatar account-sidebar-avatar-fallback" />
          )}
          <div>
            <strong>{user.name || '—'}</strong>
            <span className="muted">@{user.username || '—'}</span>
          </div>
        </div>

        {navGroups.map((group) => (
          <div key={group.section} className="account-nav-group">
            <p className="account-nav-section">{group.section}</p>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `account-nav-item${isActive ? ' active' : ''}`
                }
              >
                <span>{item.icon}</span> {item.label}
              </NavLink>
            ))}
          </div>
        ))}

        <div className="account-community-box">
          <strong>Tham gia cộng đồng</strong>
          <p className="muted">Kết nối với người dùng khác trên Discord.</p>
          <a
            href="https://discord.gg/"
            target="_blank"
            rel="noreferrer"
            className="btn secondary sm"
          >
            Tham gia Discord
          </a>
        </div>
      </aside>

      <div className="account-content">
        <Outlet />
      </div>
    </div>
  );
}
