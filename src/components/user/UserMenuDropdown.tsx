import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  clearAuth,
  getDisplayUser,
} from '../../services/authStore';
import { loadTheme, saveTheme, type ThemeMode } from '../../services/themeStore';
import {
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Clock,
  CreditCard,
  FolderKanban,
  Gift,
  LayoutDashboard,
  LogOut,
  Moon,
  Phone,
  Settings,
  Shield,
  Sun,
  User,
  Users,
  Wallet,
} from 'lucide-react';
import { APP_SITE_URL } from '../../services/settingsStore';
import { CONTACT_PHONE_TEL, contactPhoneLine } from '../../lib/brand';

const ICON = { size: 16, strokeWidth: 1.75, className: 'user-menu-item-icon' } as const;

const EXTERNAL = {
  community: 'https://discord.gg/',
  support: `${APP_SITE_URL}/support`,
  referral: `${APP_SITE_URL}/referral`,
  changelog: `${APP_SITE_URL}/changelog`,
};

interface Props {
  credits: number;
  /** Ví nội bộ platform — hiện cạnh VMedia khi admin. */
  platformCredits?: number;
  /** Admin đang xem 2 ví (nội bộ + VMedia). */
  isAdmin?: boolean;
  onCreditsRefresh?: () => void;
}

export default function UserMenuDropdown({
  credits,
  platformCredits,
  isAdmin = false,
  onCreditsRefresh,
}: Props) {
  const navigate = useNavigate();
  const user = getDisplayUser();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(loadTheme());
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  function logout() {
    clearAuth();
    navigate('/login');
  }

  function toggleTheme() {
    const next: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    saveTheme(next);
    setTheme(next);
  }

  const handle = user.username ? `@${user.username}` : user.email;

  return (
    <div className="user-menu-root" ref={rootRef}>
      <button
        type="button"
        className="user-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {user.avatar ? (
          <img src={user.avatar} alt="" className="user-menu-avatar" />
        ) : (
          <span className="user-menu-avatar user-menu-avatar-fallback" />
        )}
        <ChevronDown size={14} className={`user-menu-caret ${open ? 'up' : ''}`} />
      </button>

      {open && (
        <div className="user-menu-panel">
          <div className="user-menu-head">
            {user.avatar ? (
              <img src={user.avatar} alt="" className="user-menu-head-avatar" />
            ) : (
              <span className="user-menu-head-avatar user-menu-avatar-fallback" />
            )}
            <div>
              <div className="user-menu-name">{user.name || user.email || 'User'}</div>
              <div className="user-menu-handle">{handle}</div>
            </div>
          </div>

          {isAdmin ? (
            <div className="user-menu-balances">
              <button
                type="button"
                className="user-menu-balance"
                onClick={() => { onCreditsRefresh?.(); setOpen(false); navigate('/wallet'); }}
              >
                <span className="user-menu-balance-left">
                  <Wallet {...ICON} />
                  Ví nội bộ
                </span>
                <strong className="user-menu-balance-platform">
                  {(platformCredits ?? 0).toLocaleString('vi-VN')}
                </strong>
              </button>
              <button
                type="button"
                className="user-menu-balance"
                onClick={() => { onCreditsRefresh?.(); setOpen(false); navigate('/wallet'); }}
              >
                <span className="user-menu-balance-left">
                  <Wallet {...ICON} />
                  Pro.agi.vn
                </span>
                <strong>{credits.toLocaleString('vi-VN')}</strong>
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="user-menu-balance"
              onClick={() => { onCreditsRefresh?.(); setOpen(false); }}
            >
              <span className="user-menu-balance-left">
                <Wallet {...ICON} />
                Số dư
              </span>
              <strong>{credits.toLocaleString('vi-VN')}</strong>
            </button>
          )}

          <div className="user-menu-section user-menu-theme-row">
            <span>GIAO DIỆN</span>
            <button type="button" className="user-menu-theme-btn" onClick={toggleTheme}>
              {theme === 'dark' ? (
                <>
                  <Sun {...ICON} /> Sáng
                </>
              ) : (
                <>
                  <Moon {...ICON} /> Tối
                </>
              )}
            </button>
          </div>

          <nav className="user-menu-nav">
            <Link to="/projects" className="user-menu-item" onClick={() => setOpen(false)}>
              <FolderKanban {...ICON} /> Quản lý dự án
            </Link>
            <Link to="/dashboard" className="user-menu-item" onClick={() => setOpen(false)}>
              <LayoutDashboard {...ICON} /> Dashboard
            </Link>
            <Link to="/wallet" className="user-menu-item" onClick={() => setOpen(false)}>
              <CreditCard {...ICON} /> Ví credit
            </Link>
            <Link to="/profile" className="user-menu-item" onClick={() => setOpen(false)}>
              <User {...ICON} /> Xem hồ sơ
            </Link>
            <Link to="/usage-history" className="user-menu-item" onClick={() => setOpen(false)}>
              <Clock {...ICON} /> Lịch sử sử dụng
            </Link>
            <Link to="/account" className="user-menu-item" onClick={() => setOpen(false)}>
              <Shield {...ICON} /> Quản lý tài khoản
            </Link>
            <Link to="/settings" className="user-menu-item" onClick={() => setOpen(false)}>
              <Settings {...ICON} /> Cài đặt
            </Link>
            <a href={EXTERNAL.community} target="_blank" rel="noreferrer" className="user-menu-item">
              <Users {...ICON} /> Tham gia cộng đồng
            </a>
            <a href={EXTERNAL.support} target="_blank" rel="noreferrer" className="user-menu-item">
              <CircleHelp {...ICON} /> Trung tâm hỗ trợ
            </a>
            <a href={CONTACT_PHONE_TEL} className="user-menu-item">
              <Phone {...ICON} /> {contactPhoneLine('Liên hệ')}
            </a>
            <a href={EXTERNAL.referral} target="_blank" rel="noreferrer" className="user-menu-item">
              <Gift {...ICON} /> Giới thiệu bạn bè
            </a>
            <a href={EXTERNAL.changelog} target="_blank" rel="noreferrer" className="user-menu-item">
              <ClipboardList {...ICON} /> Changelog
            </a>
          </nav>

          <button type="button" className="user-menu-logout" onClick={logout}>
            <LogOut {...ICON} className="user-menu-item-icon user-menu-item-icon--danger" /> Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}
