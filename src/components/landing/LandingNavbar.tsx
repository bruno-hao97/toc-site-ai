import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { getCreditsAi, getDisplayUser, isLoggedIn } from '../../services/authStore';
import { NAV_LINKS, appEntryPath } from '../../lib/landingConfig';

export default function LandingNavbar() {
  const loggedIn = isLoggedIn();
  const credits = loggedIn ? getCreditsAi() : null;
  const user = loggedIn ? getDisplayUser() : null;
  const appPath = appEntryPath();

  return (
    <nav className="landing-nav">
      <div className="container">
        <Link to="/" className="logo-row">
          <img src="/logo.png" alt="AI Center" className="logo-img" />
        </Link>

        <div className="nav-links">
          {NAV_LINKS.map((item) => (
            <a key={item.label} href={item.href}>
              {item.label}
            </a>
          ))}
        </div>

        <div className="nav-actions">
          {loggedIn && credits != null ? (
            <span className="credits-badge">
              <Zap size={12} />
              {credits.toLocaleString('vi-VN')} credits
            </span>
          ) : (
            <span className="credits-badge">
              <Zap size={12} />
              41 credits
            </span>
          )}
          {loggedIn && user?.avatar ? (
            <img src={user.avatar} alt="" className="nav-avatar" style={{ objectFit: 'cover', padding: 0 }} />
          ) : loggedIn ? (
            <span className="nav-avatar">{(user?.name || 'U').charAt(0)}</span>
          ) : null}
          {!loggedIn && (
            <Link to="/login" className="nav-login">
              Đăng nhập
            </Link>
          )}
          <Link to={appPath} className="cta-btn">
            Truy cập APP
          </Link>
        </div>
      </div>
    </nav>
  );
}
