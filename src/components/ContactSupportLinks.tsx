import { Mail, Phone } from 'lucide-react';
import {
  CONTACT_EMAIL,
  CONTACT_EMAIL_MAILTO,
  CONTACT_PHONE_DISPLAY,
  CONTACT_PHONE_TEL,
} from '../lib/brand';

interface Props {
  className?: string;
  linkClassName?: string;
  iconSize?: number;
  layout?: 'stack' | 'inline';
}

export default function ContactSupportLinks({
  className = '',
  linkClassName = 'contact-support-link',
  iconSize = 14,
  layout = 'inline',
}: Props) {
  return (
    <div className={`contact-support-links contact-support-links--${layout}${className ? ` ${className}` : ''}`}>
      <a href={CONTACT_PHONE_TEL} className={linkClassName}>
        <Phone size={iconSize} strokeWidth={1.75} aria-hidden />
        {CONTACT_PHONE_DISPLAY}
      </a>
      <a href={CONTACT_EMAIL_MAILTO} className={linkClassName}>
        <Mail size={iconSize} strokeWidth={1.75} aria-hidden />
        {CONTACT_EMAIL}
      </a>
    </div>
  );
}
