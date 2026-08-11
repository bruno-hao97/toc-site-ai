import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, Phone, User, UserPlus, X } from 'lucide-react';
import { loginWithPlatformSession } from '../services/authStore';
import { platformRegister, PlatformAuthError } from '../services/platformAuth';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError('Mật khẩu cần ít nhất 6 ký tự');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { token, user } = await platformRegister({
        email,
        password,
        name: name.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      await loginWithPlatformSession(token, user);
      navigate('/home');
    } catch (err) {
      setError(err instanceof PlatformAuthError || err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page auth-page auth-login">
      <div className="auth-card auth-card-79 auth-card-glass">
        <button type="button" className="auth-close" onClick={() => navigate(-1)} aria-label="Đóng">
          <X size={18} />
        </button>

        <div className="auth-head">
          <div className="auth-head-icon auth-head-icon-purple">
            <UserPlus size={26} />
          </div>
          <h1>Đăng ký</h1>
          <p>Tạo tài khoản AGI Center miễn phí.</p>
        </div>

        <form onSubmit={handleSubmit} className="form">
          <label className="field">
            <span className="label">Tên hiển thị</span>
            <span className="auth-input">
              <User size={16} className="auth-input-icon" />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tên của bạn"
                autoComplete="name"
              />
            </span>
          </label>
          <label className="field">
            <span className="label">Email</span>
            <span className="auth-input">
              <Mail size={16} className="auth-input-icon" />
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
          <label className="field">
            <span className="label">Số điện thoại</span>
            <span className="auth-input">
              <Phone size={16} className="auth-input-icon" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0xxxxxxxxx"
                autoComplete="tel"
                required
              />
            </span>
          </label>
          <label className="field">
            <span className="label">Mật khẩu (≥6 ký tự)</span>
            <span className="auth-input">
              <Lock size={16} className="auth-input-icon" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                placeholder="••••••••"
                autoComplete="new-password"
                required
              />
            </span>
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn auth-submit" disabled={loading}>
            {loading ? 'Đang tạo tài khoản…' : 'Đăng ký'}
          </button>
        </form>

        <p className="auth-register">
          Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
        </p>
      </div>
    </div>
  );
}
