import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import MarketingPageShell from './MarketingPageShell';
import { BRAND_NAME } from '../lib/brand';

interface Props {
  icon: LucideIcon;
  title: string;
  updated: string;
  otherLink: { to: string; label: string };
  children: ReactNode;
}

export default function LegalPageShell({ icon: Icon, title, updated, otherLink, children }: Props) {
  return (
    <MarketingPageShell className="legal-page">
      <div className="container legal-page-inner">
        <nav className="legal-topnav" aria-label="Legal">
          <Link to="/" className="legal-topnav-home">
            Trang chủ
          </Link>
          <Link to={otherLink.to} className="legal-topnav-alt">
            {otherLink.label}
          </Link>
        </nav>

        <article className="legal-card">
          <header className="legal-card-head">
            <span className="legal-card-icon" aria-hidden>
              <Icon size={22} strokeWidth={1.75} />
            </span>
            <h1>{title}</h1>
            <p className="legal-updated">Cập nhật lần cuối: {updated}</p>
          </header>

          <div className="legal-body">{children}</div>
        </article>

        <p className="legal-page-copy">
          © {new Date().getFullYear()} {BRAND_NAME}. Đã đăng ký bản quyền.
        </p>
      </div>
    </MarketingPageShell>
  );
}
