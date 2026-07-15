import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
    <div className="page auth-page">
      <div className="auth-card panel">
        <h1>Đăng ký</h1>
        <p className="lead">Tạo tài khoản AI Center miễn phí.</p>

        <form onSubmit={handleSubmit} className="form">
          <label className="field">
            <span className="label">Tên hiển thị</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tên của bạn"
            />
          </label>
          <label className="field">
            <span className="label">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>
          <label className="field">
            <span className="label">Số điện thoại</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0xxxxxxxxx"
              required
            />
          </label>
          <label className="field">
            <span className="label">Mật khẩu (≥6 ký tự)</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              placeholder="••••••••"
              required
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn primary" disabled={loading}>
            {loading ? 'Đang tạo tài khoản…' : 'Đăng ký'}
          </button>
        </form>

        <div className="auth-links">
          <span>
            Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
          </span>
        </div>
      </div>
    </div>
  );
}
