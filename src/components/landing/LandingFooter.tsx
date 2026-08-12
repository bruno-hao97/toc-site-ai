import { Link } from 'react-router-dom';
import BrandLogo from '../BrandLogo';
import { BRAND_NAME, CONTACT_EMAIL_MAILTO, CONTACT_PHONE_TEL, contactEmailLine, contactPhoneLine } from '../../lib/brand';
import { SUPPORT_LINKS } from '../../config/supportLinks';
import { scrollAppToTop } from '../../lib/scrollAppToTop';
import SupportLinkIcons from '../SupportLinkIcons';

const FOOT_PLATFORM = [
  { label: 'Tính năng', href: '/features' },
  { label: 'Models', href: '/models' },
  { label: 'Khám phá', href: '/explore' },
  { label: 'Bảng giá', href: '/pricing' },
] as const;

const FOOT_LEGAL = [
  { label: 'Chính sách bảo mật', href: '/privacy' },
  { label: 'Điều khoản dịch vụ', href: '/terms' },
  { label: contactPhoneLine('Liên hệ'), href: CONTACT_PHONE_TEL },
  { label: contactEmailLine('Email'), href: CONTACT_EMAIL_MAILTO },
] as const;

function FootLink({ label, href }: { label: string; href: string }) {
  if (href.startsWith('/') && !href.startsWith('//')) {
    return (
      <Link to={href} className="foot-col-link" onClick={() => scrollAppToTop()}>
        {label}
      </Link>
    );
  }

  return (
    <a href={href} className="foot-col-link">
      {label}
    </a>
  );
}

function FootColumn({
  title,
  links,
  ariaLabel,
}: {
  title: string;
  links: ReadonlyArray<{ label: string; href: string }>;
  ariaLabel: string;
}) {
  return (
    <nav className="foot-col" aria-label={ariaLabel}>
      <p className="foot-col-title">{title}</p>
      <ul className="foot-col-links">
        {links.map((link) => (
          <li key={link.href}>
            <FootLink label={link.label} href={link.href} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function LandingFooter() {
  return (
    <footer className="footer">
      <div className="container foot-grid">
        <div className="foot-col foot-col-brand">
          <BrandLogo to="/" />
          <p className="foot-tagline">
            Model mới, giá thật — một cổng cho ảnh, video, nhạc và chat.
          </p>
          <SupportLinkIcons links={SUPPORT_LINKS} />
        </div>

        <FootColumn title="Nền tảng" links={FOOT_PLATFORM} ariaLabel="Nền tảng" />
        <FootColumn title="Pháp lý & hỗ trợ" links={FOOT_LEGAL} ariaLabel="Pháp lý & hỗ trợ" />
      </div>

      <div className="container foot-bottom">
        <p className="foot-bottom-copy">© {new Date().getFullYear()} {BRAND_NAME}</p>
      </div>
    </footer>
  );
}
