import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { Coins, Globe, Menu, X, Zap } from 'lucide-react';
import {
  ensureValidPlatformSession,
  handlePlatformAuthFailure,
  isAdminUser,
  isLoggedIn,
} from './services/authStore';
import { UpstreamMeError } from './services/upstreamMe';
import { useCreditsUpdated } from './hooks/useCreditsUpdated';
import { useDisplayCredits } from './hooks/useDisplayCredits';
import type { JobType } from './services/api';
import BrandLogo from './components/BrandLogo';
import AppSidebar from './components/AppSidebar';
import SessionExpiredHost from './components/SessionExpiredHost';
import AdminRoute from './components/AdminRoute';
import ProtectedRoute from './components/ProtectedRoute';
import QuickChatWidget from './components/QuickChatWidget';
import UserMenuDropdown from './components/user/UserMenuDropdown';
import LandingPage from './pages/LandingPage';
import HomePage from './pages/HomePage';
import HomeLibraryPage from './pages/HomeLibraryPage';
import ExplorePage from './pages/ExplorePage';
import ProjectsPage from './pages/ProjectsPage';
import WorkflowPage from './pages/WorkflowPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import StudioPage from './pages/StudioPage';
import AudioPage from './pages/AudioPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';
import UsageHistoryPage from './pages/UsageHistoryPage';
import StudioHistoryPage from './pages/StudioHistoryPage';
import ApiPlaygroundPage from './pages/ApiPlaygroundPage';
import DashboardPage from './pages/DashboardPage';
import WalletPage from './pages/WalletPage';
import PricingPage from './pages/PricingPage';
import ChatPage from './pages/ChatPage';
import AccountLayout from './pages/account/AccountLayout';
import AccountSettingsPage from './pages/account/AccountSettingsPage';
import AccountPromoPage from './pages/account/AccountPromoPage';
import AccountSubscriptionPage from './pages/account/AccountSubscriptionPage';
import AccountTransferPage from './pages/account/AccountTransferPage';
import AccountTransactionsPage from './pages/account/AccountTransactionsPage';
import { useLocale } from './i18n';

const STUDIO_NAV: Record<string, JobType> = {
  '/image': 'image',
  '/video': 'video',
  '/music': 'music',
};

function StudioHistoryRedirect() {
  const { type } = useParams<{ type: string }>();
  return <Navigate to={type ? `/studio-history/${type}` : '/studio-history'} replace />;
}

interface AppHeaderProps {
  slim?: boolean;
  mobileNavOpen: boolean;
  onMobileNavToggle: () => void;
}

function AppHeader({ slim = false, mobileNavOpen, onMobileNavToggle }: AppHeaderProps) {
  const { t, locale, toggleLocale } = useLocale();
  const {
    credits: displayCredits,
    platformCredits,
    isAdminVmedia,
    refresh,
  } = useDisplayCredits();
  const loggedIn = isLoggedIn();
  const isAdmin = isAdminUser();
  const showDualWallets = isAdmin && isAdminVmedia;

  function refreshCredits() {
    void refresh().catch((err) => {
      if (err instanceof UpstreamMeError && (err.status === 401 || err.status === 403)) {
        handlePlatformAuthFailure(err.status, err.message);
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
    <header className={`app-header${slim ? ' app-header--slim' : ''}`}>
      <div className="app-header-inner">
        <div className="app-header-pill">
          {loggedIn && slim && (
            <button
              type="button"
              className="nav-toggle app-header-menu-btn"
              aria-label={t('header.openMenu')}
              aria-expanded={mobileNavOpen}
              onClick={onMobileNavToggle}
            >
              {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          )}
          {!slim && <BrandLogo to={loggedIn ? '/home' : '/'} />}
          {loggedIn ? (
            <div className="header-meta">
              {!slim && (
                <>
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
                </>
              )}
              {showDualWallets ? (
                <div className="header-balance header-balance--dual">
                  <div className="header-balance-row">
                    <span className="header-balance-label">Nội bộ</span>
                    <span className="header-credit-pill header-credit-pill--platform">
                      {platformCredits.toLocaleString('vi-VN')}
                    </span>
                  </div>
                  <div className="header-balance-row">
                    <span className="header-balance-label">Pro.agi.vn</span>
                    <span className="header-credit-pill">
                      {displayCredits.toLocaleString('vi-VN')}
                    </span>
                  </div>
                </div>
              ) : (
                <Link to="/wallet" className="header-credits-badge">
                  <Zap size={12} />
                  {displayCredits.toLocaleString('vi-VN')}
                </Link>
              )}
              <UserMenuDropdown
                credits={displayCredits}
                platformCredits={platformCredits}
                isAdmin={showDualWallets}
                onCreditsRefresh={refreshCredits}
              />
            </div>
          ) : (
            <nav className="nav nav--guest">
              <Link to="/login">{t('header.login')}</Link>
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}

function AppShell() {
  const location = useLocation();
  const loggedIn = isLoggedIn();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!loggedIn) return;
    void ensureValidPlatformSession();
  }, [loggedIn]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const BARE_PAGES = ['/', '/login', '/register'];
  const isBarePage = BARE_PAGES.includes(location.pathname);
  const isWorkflow = location.pathname === '/workflow';
  const isChat = location.pathname === '/chat';
  const isHomeRoute =
    location.pathname === '/home' || location.pathname.startsWith('/home/');
  const isFullBleed =
    location.pathname in STUDIO_NAV ||
    location.pathname === '/audio' ||
    isWorkflow ||
    isChat;
  const hideHeader = isBarePage || isWorkflow || isChat;
  const showAppSidebar = loggedIn && !isBarePage && !isWorkflow && !isChat;
  const showQuickChat = loggedIn && !isBarePage && !isWorkflow && !isChat;

  return (
    <div className={`app${showAppSidebar ? ' app--shell' : ''}`}>
      {showAppSidebar && (
        <AppSidebar
          mobileOpen={mobileNavOpen}
          onMobileClose={() => setMobileNavOpen(false)}
        />
      )}
      <div className="app-body">
        {!hideHeader && (
          <AppHeader
            slim={showAppSidebar}
            mobileNavOpen={mobileNavOpen}
            onMobileNavToggle={() => setMobileNavOpen((v) => !v)}
          />
        )}
        <main
          className={
            isBarePage
              ? ''
              : `app-main${isFullBleed ? ' app-main-full' : ''}${isHomeRoute ? ' app-main-home' : ''}${isWorkflow ? ' app-main-workflow' : ''}${isChat ? ' app-main-chat' : ''}`
          }
        >
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={isLoggedIn() ? <Navigate to="/home" /> : <LoginPage />} />
            <Route path="/register" element={isLoggedIn() ? <Navigate to="/home" /> : <RegisterPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/home" element={<HomePage />} />
              <Route path="/home/library" element={<HomeLibraryPage />} />
              <Route path="/chat" element={<ChatPage />} />
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
              <Route path="/settings/tokens" element={<Navigate to="/settings" replace />} />
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
                <Route element={<AdminRoute />}>
                  <Route path="transfer" element={<AccountTransferPage />} />
                </Route>
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
      </div>
      {showQuickChat && <QuickChatWidget />}
    </div>
  );
}

export default function App() {
  return (
    <>
      <AppShell />
      <SessionExpiredHost />
    </>
  );
}
