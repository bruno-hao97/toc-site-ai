import { Link, NavLink } from 'react-router-dom';
import { Coins, Globe } from 'lucide-react';
import BrandLogo from './BrandLogo';
import { MORE_NAV, PRIMARY_NAV } from '../config/appNav';
import { useLocale } from '../i18n';

interface AppSidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

function SidebarLink({
  to,
  label,
  icon: Icon,
  end,
  onNavigate,
}: {
  to: string;
  label: string;
  icon: (typeof PRIMARY_NAV)[number]['icon'];
  end?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      title={label}
      className={({ isActive }) => `app-sidebar-link${isActive ? ' active' : ''}`}
      onClick={onNavigate}
    >
      <Icon size={22} strokeWidth={1.75} aria-hidden />
      <span className="app-sidebar-label">{label}</span>
    </NavLink>
  );
}

export default function AppSidebar({ mobileOpen, onMobileClose }: AppSidebarProps) {
  const { t, locale, toggleLocale } = useLocale();

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="app-sidebar-backdrop"
          aria-label="Đóng menu"
          onClick={onMobileClose}
        />
      )}
      <aside
        className={`app-sidebar-shell${mobileOpen ? ' app-sidebar-shell--open' : ''}`}
        aria-label="Điều hướng chính"
      >
        <div className="app-sidebar">
          <div className="app-sidebar-top">
            <BrandLogo to="/home" />
          </div>

          <nav className="app-sidebar-nav">
            {PRIMARY_NAV.map((item) => (
              <SidebarLink
                key={item.to}
                to={item.to}
                label={t(item.labelKey)}
                icon={item.icon}
                end={item.end}
                onNavigate={onMobileClose}
              />
            ))}
            <div className="app-sidebar-divider" aria-hidden />
            {MORE_NAV.map((item) => (
              <SidebarLink
                key={item.to}
                to={item.to}
                label={t(item.labelKey)}
                icon={item.icon}
                onNavigate={onMobileClose}
              />
            ))}
          </nav>

          <div className="app-sidebar-footer">
            <button
              type="button"
              className="app-sidebar-footer-btn"
              aria-label={t('header.switchLang')}
              onClick={toggleLocale}
            >
              <Globe size={16} strokeWidth={1.75} aria-hidden />
              <span>{locale === 'vi' ? 'VI' : 'EN'}</span>
            </button>
            <Link to="/pricing" className="app-sidebar-upgrade" onClick={onMobileClose}>
              <Coins size={15} strokeWidth={1.75} aria-hidden />
              <span>{t('header.pricing')}</span>
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
