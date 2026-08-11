import { Link } from 'react-router-dom';
import type { SupportLink } from '../config/supportLinks';

interface Props {
  links: SupportLink[];
  className?: string;
}

export default function SupportLinkIcons({ links, className = '' }: Props) {
  return (
    <nav
      className={`foot-support${className ? ` ${className}` : ''}`}
      aria-label="Kênh hỗ trợ & tham khảo"
    >
      {links.map(({ label, href, icon: Icon, external }) => {
        const icon = (
          <>
            <Icon size={17} strokeWidth={1.75} aria-hidden />
            <span className="foot-support-tip">{label}</span>
          </>
        );

        if (external) {
          return (
            <a
              key={label}
              href={href}
              className="foot-support-btn"
              target="_blank"
              rel="noreferrer"
              title={label}
              aria-label={label}
            >
              {icon}
            </a>
          );
        }

        return (
          <Link key={label} to={href} className="foot-support-btn" title={label} aria-label={label}>
            {icon}
          </Link>
        );
      })}
    </nav>
  );
}
