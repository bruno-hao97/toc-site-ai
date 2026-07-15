import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, KeyRound, KeySquare, Lock, User, X } from 'lucide-react';
import { loginWithGommoToken } from '../services/authStore';
import { gommoLoginWithPassword, gommoResetPassword, GommoAuthError } from '../services/gommoAuth';
import { UpstreamMeError } from '../services/upstreamMe';
import { APP_SITE_URL, DEFAULT_DOMAIN } from '../services/settingsStore';

type Step = 'menu' | 'account' | 'token' | 'reset';

export default function LoginPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('menu');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [accessToken, setAccessToken] = useState('');
  const [tokenLoading, setTokenLoading] = useState(false);

  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState('');

  function goStep(next: Step) {
    setError('');
    setResetSuccess('');
    setStep(next);
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const token = await gommoLoginWithPassword(email, password, DEFAULT_DOMAIN);
      await loginWithGommoToken(token, DEFAULT_DOMAIN);
      navigate('/home');
    } catch (err) {
      setError(err instanceof GommoAuthError || err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: FormEvent) {
    e.preventDefault();
    setResetLoading(true);
    setError('');
    setResetSuccess('');
    try {
      const message = await gommoResetPassword(email, DEFAULT_DOMAIN);
      setResetSuccess(message);
    } catch (err) {
      setError(err instanceof GommoAuthError || err instanceof Error ? err.message : String(err));
    } finally {
      setResetLoading(false);
    }
  }

  async function handleTokenLogin(e: FormEvent) {
    e.preventDefault();
    setTokenLoading(true);
    setError('');
    try {
      await loginWithGommoToken(accessToken, DEFAULT_DOMAIN);
      navigate('/home');
    } catch (err) {
      setError(err instanceof UpstreamMeError || err instanceof Error ? err.message : String(err));
    } finally {
      setTokenLoading(false);
    }
  }

  return (
    <div className="page auth-page auth-login">
      <div className="auth-card auth-card-79">
        <button type="button" className="auth-close" onClick={() => navigate(-1)} aria-label="Đóng">
          <X size={18} />
        </button>

        <div className="auth-head">
          <div className="auth-head-icon">
            <KeyRound size={26} />
          </div>
          <h1>Xác thực tài khoản</h1>
          <p>Nền tảng AI tập trung ALL in One</p>
        </div>

        {step === 'menu' && (
          <div className="auth-methods">
            <button type="button" className="auth-method" onClick={() => goStep('account')}>
              <span className="auth-method-icon teal">
                <User size={18} />
              </span>
              <span className="auth-method-text">
                <strong>Đăng nhập bằng tài khoản</strong>
                <small>Email / username và mật khẩu</small>
              </span>
              <ChevronRight size={18} className="auth-method-arrow" />
            </button>

            <button type="button" className="auth-method" onClick={() => goStep('token')}>
              <span className="auth-method-icon purple">
                <KeySquare size={18} />
              </span>
              <span className="auth-method-text">
                <strong>Đăng nhập bằng Token</strong>
                <small>Access Token nâng cao</small>
              </span>
              <ChevronRight size={18} className="auth-method-arrow" />
            </button>
          </div>
        )}

        {step === 'account' && (
          <>
            <div className="auth-switch">
              <button type="button" className="auth-back" onClick={() => goStep('menu')}>
                <ArrowLeft size={14} /> Quay lại
              </button>
              <button type="button" className="auth-switch-link" onClick={() => goStep('token')}>
                ĐĂNG NHẬP BẰNG TOKEN
              </button>
            </div>

            <form onSubmit={handleLogin} className="form">
              <label className="field">
                <span className="label">Email / hoặc username</span>
                <span className="auth-input">
                  <User size={16} className="auth-input-icon" />
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="username"
                    required
                  />
                </span>
              </label>
              <label className="field">
                <span className="label">Mật khẩu</span>
                <span className="auth-input">
                  <Lock size={16} className="auth-input-icon" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                  />
                </span>
              </label>
              <button type="button" className="auth-forgot" onClick={() => goStep('reset')}>
                Quên mật khẩu?
              </button>
              {error && <p className="error">{error}</p>}
              <button type="submit" className="btn auth-submit" disabled={loading}>
                {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
              </button>
            </form>
          </>
        )}

        {step === 'reset' && (
          <>
            <div className="auth-switch">
              <button type="button" className="auth-back" onClick={() => goStep('account')}>
                <ArrowLeft size={14} /> Quay lại
              </button>
              <span className="auth-switch-link auth-switch-current">Reset mật khẩu</span>
            </div>

            <form onSubmit={handleResetPassword} className="form">
              <p className="lead sm">
                Nhập email tài khoản, hệ thống sẽ gửi email hỗ trợ reset mật khẩu.
              </p>
              <label className="field">
                <span className="label">Email</span>
                <span className="auth-input">
                  <User size={16} className="auth-input-icon" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                </span>
              </label>
              {error && <p className="error">{error}</p>}
              {resetSuccess && (
                <p className="account-transfer-feedback success">{resetSuccess}</p>
              )}
              <button type="submit" className="btn auth-submit" disabled={resetLoading}>
                {resetLoading ? 'Đang gửi…' : 'Gửi email reset'}
              </button>
            </form>
          </>
        )}

        {step === 'token' && (
          <>
            <div className="auth-switch">
              <button type="button" className="auth-back" onClick={() => goStep('menu')}>
                <ArrowLeft size={14} /> Quay lại
              </button>
              <button type="button" className="auth-switch-link" onClick={() => goStep('account')}>
                ĐĂNG NHẬP BẰNG TÀI KHOẢN
              </button>
            </div>

            <form onSubmit={handleTokenLogin} className="form">
              <label className="field">
                <span className="label">Access Token</span>
                <span className="auth-input">
                  <KeySquare size={16} className="auth-input-icon" />
                  <input
                    type="text"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder="Dán token từ Account Settings"
                  />
                </span>
              </label>
              <p className="lead sm">
                Lấy Access Token tại Account Settings trên{' '}
                <a href={`${APP_SITE_URL}/settings/tokens`} target="_blank" rel="noreferrer">
                  {DEFAULT_DOMAIN}
                </a>.
              </p>
              {error && <p className="error">{error}</p>}
              <button type="submit" className="btn auth-submit" disabled={tokenLoading}>
                {tokenLoading ? 'Đang xác thực…' : 'Đăng nhập bằng token'}
              </button>
            </form>
          </>
        )}

        {step === 'menu' && error && <p className="error">{error}</p>}

        <p className="auth-register">
          Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link>
        </p>
      </div>
    </div>
  );
}
