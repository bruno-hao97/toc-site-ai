import type { ReactNode } from 'react';
import '../styles/landing.css';
import '../styles/marketing-pages.css';
import LandingNavbar from './landing/LandingNavbar';
import LandingFooter from './landing/LandingFooter';

interface Props {
  children: ReactNode;
  className?: string;
  hideFooter?: boolean;
}

export default function MarketingPageShell({ children, className = '', hideFooter = false }: Props) {
  return (
    <div className={`landing-page marketing-page ${className}`.trim()}>
      <LandingNavbar />
      <main className="marketing-page-main">{children}</main>
      {!hideFooter && <LandingFooter />}
    </div>
  );
}
