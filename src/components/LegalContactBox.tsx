import ContactSupportLinks from './ContactSupportLinks';

export default function LegalContactBox() {
  return (
    <aside className="legal-contact">
      <p className="legal-contact-label">Liên hệ hỗ trợ</p>
      <ContactSupportLinks layout="stack" linkClassName="legal-contact-value" iconSize={16} />
    </aside>
  );
}
