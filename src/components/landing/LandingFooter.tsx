import BrandLogo from '../BrandLogo';
import { CONTACT_PHONE_TEL, contactPhoneLine } from '../../lib/brand';

const footLinks = [
  { label: 'Models', href: '#models' },
  { label: 'Bảng giá', href: '#pricing' },
  { label: 'API', href: '#features' },
  { label: contactPhoneLine('Liên hệ'), href: CONTACT_PHONE_TEL },
];

export default function LandingFooter() {
  return (
    <footer className="footer">
      <div className="container">
        <p className="foot-stmt-line">
          Model mới, giá thật — một cổng cho ảnh, video, nhạc và code.
        </p>
        <div className="foot-stmt-meta">
          <BrandLogo to="/" />
          <nav className="foot-links" aria-label="Footer">
            {footLinks.map((link) => (
              <a key={link.label} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
          <span className="copyright">© {new Date().getFullYear()} AGI Center</span>
        </div>
      </div>
    </footer>
  );
}
