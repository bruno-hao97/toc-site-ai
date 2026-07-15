import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { Coins, Globe, Menu, X } from 'lucide-react';
import {
  clearAuth,
  getCreditsAi,
  isLoggedIn,
  loadAuth,
  refreshSession,
} from './services/authStore';
import { UpstreamMeError } from './services/upstreamMe';
import { useCreditsUpdated } from './hooks/useCreditsUpdated';
import type { JobType } from './services/api';
import BrandLogo from './components/BrandLogo';
import ProtectedRoute from './components/ProtectedRoute';
import QuickChatWidget from './components/QuickChatWidget';
import UserMenuDropdown from './components/user/UserMenuDropdown';
import LandingPage from './pages/LandingPage';
import HomePage from './pages/HomePage';
import ExplorePage from './pages/ExplorePage';
import ProjectsPage from './pages/ProjectsPage';
import WorkflowPage from './pages/WorkflowPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import StudioPage from './pages/StudioPage';
import AudioPage from './pages/AudioPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';
import SettingsTokensPage from './pages/SettingsTokensPage';
import UsageHistoryPage from './pages/UsageHistoryPage';
import StudioHistoryPage from './pages/StudioHistoryPage';
import ApiPlaygroundPage from './pages/ApiPlaygroundPage';
import DashboardPage from './pages/DashboardPage';
import WalletPage from './pages/WalletPage';
import PricingPage from './pages/PricingPage';
import AccountLayout from './pages/account/AccountLayout';
import AccountSettingsPage from './pages/account/AccountSettingsPage';
import AccountPromoPage from './pages/account/AccountPromoPage';
import AccountSubscriptionPage from './pages/account/AccountSubscriptionPage';
import AccountTransferPage from './pages/account/AccountTransferPage';
import AccountTransactionsPage from './pages/account/AccountTransactionsPage';
import { useLocale } from './i18n';
import type { TranslationKey } from './i18n';

const MAIN_NAV: { to: string; labelKey: TranslationKey }[] = [
  { to: '/home', labelKey: 'nav.home' },
  { to: '/explore', labelKey: 'nav.explore' },
  { to: '/projects', labelKey: 'nav.projects' },
  { to: '/image', labelKey: 'nav.image' },
  { to: '/video', labelKey: 'nav.video' },
  { to: '/audio', labelKey: 'nav.audio' },
  { to: '/music', labelKey: 'nav.music' },
  { to: '/workflow', labelKey: 'nav.workflow' },
];

const STUDIO_NAV: Record<string, JobType> = {
  '/image': 'image',
  '/video': 'video',
  '/music': 'music',
};

function StudioHistoryRedirect() {
  const { type } = useParams<{ type: string }>();
  return <Navigate to={type ? `/studio-history/${type}` : '/studio-history'} replace />;
}

function AppHeader() {
  const { t, locale, toggleLocale } = useLocale();
  const [credits, setCredits] = useState(getCreditsAi());
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const loggedIn = isLoggedIn();
  const location = useLocation();

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  function refreshCredits() {
    if (!loadAuth()) return;
    refreshSession()
      .then((s) => setCredits(s.upstream_me.balancesInfo?.credits_ai ?? 0))
      .catch((err) => {
        if (err instanceof UpstreamMeError && (err.status === 401 || err.status === 403)) {
          clearAuth();
          window.location.href = '/login';
        }
      });
  }

  useEffect(() => {
    if (!loggedIn) return;
    refreshCredits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  useCreditsUpdated(() => {
    if (loggedIn) refreshCredits();
  });

  return (
    <header className="app-header">
      <div className="app-header-inner">
        {loggedIn && (
          <button
            type="button"
            className="nav-toggle"
            aria-label={t('header.openMenu')}
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((v) => !v)}
          >
            {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        )}
        <BrandLogo to="/" />
        {loggedIn ? (
          <>
            <nav className={`nav-main ${mobileNavOpen ? 'open' : ''}`}>
              {MAIN_NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `nav-main-link ${isActive ? 'active' : ''}`}
                >
                  {t(item.labelKey)}
                </NavLink>
              ))}
            </nav>
            {mobileNavOpen && (
              <div
                className="nav-backdrop"
                onClick={() => setMobileNavOpen(false)}
                aria-hidden="true"
              />
            )}
            <div className="header-meta">
              <button
                type="button"
                className="lang-pill"
                aria-label={t('header.switchLang')}
                onClick={toggleLocale}
              >
                <Globe size={14} /> {locale === 'vi' ? 'VI' : 'EN'}
              </button>
              <Link to="/pricing" className="price-pill">
                <Coins size={15} /> {t('header.pricing')}
              </Link>
              <div className="header-balance">
                <span className="header-balance-label">{t('header.balance')}</span>
                <span className="header-credit-pill">
                  {credits.toLocaleString('vi-VN')}
                </span>
              </div>
              <UserMenuDropdown credits={credits} onCreditsRefresh={refreshCredits} />
            </div>
          </>
        ) : (
          <nav className="nav">
            <Link to="/login">{t('header.login')}</Link>
          </nav>
        )}
      </div>
    </header>
  );
}

function AppShell() {
  const location = useLocation();
  const BARE_PAGES = ['/', '/login', '/register'];
  const isBarePage = BARE_PAGES.includes(location.pathname);
  const isWorkflow = location.pathname === '/workflow';
  const isFullBleed =
    location.pathname in STUDIO_NAV ||
    location.pathname === '/audio' ||
    isWorkflow;
  const hideHeader = isBarePage || isWorkflow;
  const showQuickChat = isLoggedIn() && !isBarePage && !isWorkflow;

  return (
    <div className={isBarePage ? '' : 'app'}>
      {!hideHeader && <AppHeader />}
      <main
        className={isBarePage ? '' : `app-main ${isFullBleed ? 'app-main-full' : ''} ${isWorkflow ? 'app-main-workflow' : ''}`}
      >
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={isLoggedIn() ? <Navigate to="/home" /> : <LoginPage />} />
          <Route path="/register" element={isLoggedIn() ? <Navigate to="/home" /> : <RegisterPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/home" element={<HomePage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/workflow" element={<WorkflowPage />} />
            <Route path="/audio" element={<AudioPage />} />
            {Object.entries(STUDIO_NAV).map(([path, type]) => (
              <Route
                key={path}
                path={path}
                element={
                  <StudioPage key={path} initialType={type} lockType layout="composer" />
                }
              />
            ))}
            <Route path="/app" element={<Navigate to="/image" replace />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/playground" element={<ApiPlaygroundPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/tokens" element={<SettingsTokensPage />} />
            <Route path="/usage-history" element={<UsageHistoryPage />} />
            <Route path="/usage-history/:type" element={<UsageHistoryPage />} />
            <Route path="/studio-history" element={<StudioHistoryPage />} />
            <Route path="/studio-history/:type" element={<StudioHistoryPage />} />
            <Route path="/history" element={<Navigate to="/studio-history" replace />} />
            <Route path="/history/:type" element={<StudioHistoryRedirect />} />
            <Route path="/account" element={<AccountLayout />}>
              <Route index element={<AccountSettingsPage />} />
              <Route path="promo" element={<AccountPromoPage />} />
              <Route path="subscription" element={<AccountSubscriptionPage />} />
              <Route path="transfer" element={<AccountTransferPage />} />
              <Route path="topup" element={<Navigate to="/pricing" replace />} />
              <Route path="transactions" element={<AccountTransactionsPage />} />
            </Route>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/wallet" element={<WalletPage />} />
            <Route path="/pricing" element={<PricingPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
      {showQuickChat && <QuickChatWidget />}
    </div>
  );
}

export default function App() {
  return <AppShell />;
}
