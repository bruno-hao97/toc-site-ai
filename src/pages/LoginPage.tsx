import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound, Lock, User, X } from 'lucide-react';
import { loginWithPlatformSession } from '../services/authStore';
import { platformLogin, PlatformAuthError } from '../services/platformAuth';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { token, user } = await platformLogin(email, password);
      await loginWithPlatformSession(token, user);
      navigate('/home');
    } catch (err) {
      setError(
        err instanceof PlatformAuthError || err instanceof Error ? err.message : String(err),
      );
    } finally {
      setLoading(false);
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
              {error && <p className="error">{error}</p>}
              <button type="submit" className="btn auth-submit" disabled={loading}>
                {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
              </button>
        </form>

        <p className="auth-register">
          Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link>
        </p>
      </div>
    </div>
  );
}
