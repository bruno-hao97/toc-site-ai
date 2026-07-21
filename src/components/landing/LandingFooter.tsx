import { Link } from 'react-router-dom';

const footerLinks = {
  'Nền tảng': [
    { label: 'Models', href: '#models' },
    { label: 'Bảng giá', href: '#pricing' },
    { label: 'Tài liệu', href: '#features' },
    { label: 'Phiên chuyển API', href: '#features' },
  ],
  'Bảng giá': [
    { label: 'Giá cả', href: '#pricing' },
    { label: 'Gói dịch vụ', href: '#pricing' },
  ],
  'Công ty': [
    { label: 'Về chúng tôi', href: '#' },
    { label: 'Liên hệ', href: '#' },
  ],
} as const;

export default function LandingFooter() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-logo-col">
            <Link to="/" className="logo-row" style={{ marginBottom: 12 }}>
              <img src="/logo.png" alt="AI Center" className="logo-img" />
            </Link>
            <p className="footer-tagline">
              Nền tảng AI đa phương thức — ảnh, video, âm nhạc, text và code trong một cổng API thống nhất.
            </p>
            <div className="social-icons">
              <a href="https://facebook.com" target="_blank" rel="noreferrer" className="social-icon" aria-label="Facebook">f</a>
              <a href="https://github.com" target="_blank" rel="noreferrer" className="social-icon" aria-label="GitHub">⌘</a>
            </div>
          </div>

          {Object.entries(footerLinks).map(([heading, links]) => (
            <div key={heading} className="footer-col">
              <h4>{heading}</h4>
              <ul>
                {links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href}>{link.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="footer-bottom">
          <span className="copyright">© {new Date().getFullYear()} AI Center. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
