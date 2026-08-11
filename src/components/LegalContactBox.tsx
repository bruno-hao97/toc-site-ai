import { Phone } from 'lucide-react';
import { CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL } from '../lib/brand';

export default function LegalContactBox() {
  return (
    <aside className="legal-contact">
      <p className="legal-contact-label">Liên hệ hỗ trợ</p>
      <a href={CONTACT_PHONE_TEL} className="legal-contact-value">
        <Phone size={16} strokeWidth={1.75} aria-hidden />
        {CONTACT_PHONE_DISPLAY}
      </a>
    </aside>
  );
}
