import { FormEvent, useState } from 'react';
import { getDisplayUser, getUpstreamMe, loadAuth } from '../../services/authStore';
import { gommoChangePassword } from '../../services/gommoAuth';

export default function AccountSettingsPage() {
  const user = getDisplayUser();
  const me = getUpstreamMe();
  const [name, setName] = useState(user.name || '');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  function handleProfile(e: FormEvent) {
    e.preventDefault();
    setNotice('');
    setError('');
    setNotice('Cập nhật hồ sơ upstream sẽ có khi tích hợp API Gommo user.update.');
  }

  async function handlePassword(e: FormEvent) {
    e.preventDefault();
    setNotice('');
    setError('');
    if (!currentPw) {
      setError('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    if (newPw !== confirmPw) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (newPw.length < 6) {
      setError('Mật khẩu mới tối thiểu 6 ký tự.');
      return;
    }

    const auth = loadAuth();
    if (!auth?.access_token) {
      setError('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const message = await gommoChangePassword({
        accessToken: auth.access_token,
        domain: auth.domain,
        currentPassword: currentPw,
        newPassword: newPw,
      });
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setNotice(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đổi mật khẩu thất bại.');
    } finally {
      setIsChangingPassword(false);
    }
  }

  return (
    <div className="account-settings">
      <h1 className="account-content-title">⚙ CÀI ĐẶT TÀI KHOẢN</h1>

      <section className="panel account-card">
        <h2>👤 Thông tin hồ sơ</h2>
        <form onSubmit={handleProfile} className="form account-form">
          <label className="field">
            <span className="label">TÊN HIỂN THỊ</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span className="label">ĐỊA CHỈ EMAIL</span>
            <input value={user.email || me?.userInfo?.email || ''} readOnly />
          </label>
        </form>
      </section>

      <section className="panel account-card">
        <h2>🔑 Đổi mật khẩu</h2>
        <form onSubmit={handlePassword} className="form account-form">
          <label className="field">
            <span className="label">MẬT KHẨU HIỆN TẠI</span>
            <input
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <label className="field">
            <span className="label">MẬT KHẨU MỚI</span>
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </label>
          <label className="field">
            <span className="label">XÁC NHẬN MẬT KHẨU</span>
            <input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </label>
          <button type="submit" className="btn account-teal-btn" disabled={isChangingPassword}>
            {isChangingPassword ? 'Đang cập nhật…' : 'Cập nhật mật khẩu'}
          </button>
        </form>
      </section>

      {notice && <p className="notice">{notice}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
