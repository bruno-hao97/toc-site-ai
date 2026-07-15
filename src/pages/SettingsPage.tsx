import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { clearAuth, loadAuth } from '../services/authStore';
import { loadOpenaiKey, saveOpenaiKey } from '../services/openaiKeyStore';
import { loadTheme, saveTheme, type ThemeMode } from '../services/themeStore';

export default function SettingsPage() {
  const auth = loadAuth();
  const domain = auth?.domain || '—';
  const [theme, setTheme] = useState<ThemeMode>(loadTheme());
  const [layoutWide, setLayoutWide] = useState(false);
  const [emailNotif, setEmailNotif] = useState(true);
  const [openaiKey, setOpenaiKey] = useState(loadOpenaiKey());
  const [openaiSaved, setOpenaiSaved] = useState(false);

  function handleLogout() {
    clearAuth();
    window.location.href = '/login';
  }

  function setThemeMode(mode: ThemeMode) {
    saveTheme(mode);
    setTheme(mode);
  }

  function saveOpenai(e: FormEvent) {
    e.preventDefault();
    saveOpenaiKey(openaiKey);
    setOpenaiSaved(true);
    setTimeout(() => setOpenaiSaved(false), 2000);
  }

  return (
    <div className="page settings-79">
      <div className="page-head">
        <h1>Cài đặt</h1>
        <p className="lead">
          Quản lý cài đặt tài khoản, bảo mật, API và các tính năng khác.
        </p>
      </div>

      <div className="settings-79-stack">
        <section className="panel settings-79-section">
          <h2>🌐 API &amp; WEBHOOK</h2>
          <div className="settings-79-row">
            <div>
              <div className="settings-79-row-title">Domain kết nối</div>
              <div className="settings-79-row-desc">Domain của bạn để nhận yêu cầu từ hệ thống.</div>
            </div>
            <span className="settings-79-domain">{domain}</span>
          </div>
          <div className="settings-79-row">
            <div>
              <div className="settings-79-row-title">API Access Token</div>
              <div className="settings-79-row-desc">
                Sử dụng token này để kết nối với các ứng dụng bên thứ 3.
              </div>
            </div>
            <Link to="/settings/tokens" className="btn secondary sm">
              Sao chép &amp; Tạo mới
            </Link>
          </div>
        </section>

        <section className="panel settings-79-section">
          <h2>
            ✨ API Key OpenAI
            <span className="settings-79-tag">Dùng API riêng</span>
          </h2>
          <form onSubmit={saveOpenai} className="settings-79-openai-row">
            <input
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder="sk-..."
              className="settings-79-openai-input"
            />
            <button type="submit" className="btn primary sm">Lưu</button>
          </form>
          <p className="settings-79-openai-foot muted">
            {openaiSaved ? 'Đã lưu key.' : openaiKey ? 'Key đã cấu hình (ẩn khi reload).' : 'Chưa có key nào được thêm vào hệ thống'}
          </p>
        </section>

        <section className="panel settings-79-section">
          <h2>🎨 Giao diện</h2>
          <div className="settings-79-row">
            <div>
              <div className="settings-79-row-title">Chế độ giao diện</div>
            </div>
            <div className="settings-79-segment">
              <button
                type="button"
                className={theme === 'light' ? 'active' : ''}
                onClick={() => setThemeMode('light')}
              >
                Sáng
              </button>
              <button
                type="button"
                className={theme === 'dark' ? 'active' : ''}
                onClick={() => setThemeMode('dark')}
              >
                Tối
              </button>
            </div>
          </div>
          <div className="settings-79-row">
            <div>
              <div className="settings-79-row-title">Bố cục</div>
              <div className="settings-79-row-desc">Thay đổi bố cục hiển thị của trang web.</div>
            </div>
            <label className="settings-79-toggle">
              <input
                type="checkbox"
                checked={layoutWide}
                onChange={(e) => setLayoutWide(e.target.checked)}
              />
              <span />
            </label>
          </div>
        </section>

        <section className="panel settings-79-section">
          <h2>🔔 Thông báo</h2>
          <div className="settings-79-row">
            <div>
              <div className="settings-79-row-title">Thông báo đẩy</div>
              <div className="settings-79-row-desc">
                Nhận thông báo về các cập nhật, tin nhắn mới và các hoạt động khác.
              </div>
            </div>
            <button type="button" className="btn settings-79-gradient-btn" disabled>
              Bật thông báo
            </button>
          </div>
          <div className="settings-79-row">
            <div>
              <div className="settings-79-row-title">Thông báo Email</div>
              <div className="settings-79-row-desc">Nhận thông báo qua email cá nhân của bạn.</div>
            </div>
            <label className="settings-79-toggle">
              <input
                type="checkbox"
                checked={emailNotif}
                onChange={(e) => setEmailNotif(e.target.checked)}
              />
              <span />
            </label>
          </div>
        </section>

        <section className="panel settings-79-section">
          <h2>🛡 Bảo mật</h2>
          <div className="settings-79-row">
            <div>
              <div className="settings-79-row-title">Phiên hoạt động</div>
              <div className="settings-79-row-desc">Quản lý các thiết bị đang đăng nhập vào tài khoản.</div>
            </div>
            <button type="button" className="btn ghost sm" onClick={handleLogout}>
              Đăng xuất hết
            </button>
          </div>
          <div className="settings-79-row">
            <div>
              <div className="settings-79-row-title">Đổi mật khẩu</div>
              <div className="settings-79-row-desc">Thay đổi mật khẩu đăng nhập của bạn.</div>
            </div>
            <Link to="/account" className="btn ghost sm">Đổi mật khẩu</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
