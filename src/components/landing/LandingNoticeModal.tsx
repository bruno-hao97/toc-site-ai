import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
} from 'lucide-react';
import BrandLogo from '../BrandLogo';
import { contactPhoneLine } from '../../lib/brand';
import { SUPPORT_LINKS } from '../../config/supportLinks';

interface Props {
  open: boolean;
  onAccept: () => void;
}

const PROHIBITED_ITEMS = [
  'Nội dung 18+, khiêu dâm, bạo lực hoặc phản cảm',
  'Thông tin nhạy cảm, lừa đảo, giả mạo hoặc vi phạm pháp luật',
  'Cá cược, cờ bạc và các hành vi trái quy định cộng đồng',
];

export default function LandingNoticeModal({ open, onAccept }: Props) {
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAgreed(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="landing-notice-backdrop" role="presentation">
      <div
        className="landing-notice-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="landing-notice-title"
      >
        <div className="landing-notice-accent" aria-hidden="true" />

        <header className="landing-notice-head">
          <h2 id="landing-notice-title">Thông báo</h2>
        </header>

        <div className="landing-notice-body">
          <div className="landing-notice-brand">
            <BrandLogo to={null} />
            <span className="landing-notice-brand-text">Thông báo từ Pro.agi.vn</span>
          </div>

          <h3 className="landing-notice-title">
            Sử dụng AI có trách nhiệm — vi phạm có thể bị khóa tài khoản
          </h3>
          <p className="landing-notice-lead">
            Hỗ trợ cộng đồng và bảng giá minh bạch. Tuân thủ quy định để dùng dịch vụ ổn định.
          </p>

          <section className="landing-notice-warn" aria-labelledby="landing-notice-warn-title">
            <div className="landing-notice-warn-head">
              <span className="landing-notice-warn-icon" aria-hidden="true">
                <AlertTriangle size={22} />
              </span>
              <h4 id="landing-notice-warn-title">NGHIÊM CẤM VI PHẠM</h4>
            </div>
            <ul>
              {PROHIBITED_ITEMS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="landing-notice-warn-foot">
              {contactPhoneLine('Liên hệ hỗ trợ')} · Mọi hành vi vi phạm sẽ bị xử lý theo quy định.
            </p>
          </section>

          <div className="landing-notice-links-wrap">
            <p className="landing-notice-links-label">Kênh hỗ trợ &amp; tham khảo</p>
            <div className="landing-notice-links">
              {SUPPORT_LINKS.map(({ label, href, icon: Icon, external }) => (
                <a
                  key={label}
                  href={href}
                  className="landing-notice-link"
                  {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
                  onClick={external || href.startsWith('#') ? undefined : onAccept}
                >
                  <span className="landing-notice-link-icon">
                    <Icon size={18} />
                  </span>
                  <span>{label}</span>
                </a>
              ))}
            </div>
          </div>

          <label className="landing-notice-agree">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <span>Tôi đã đọc và cam kết tuân thủ quy định sử dụng</span>
          </label>
        </div>

        <footer className="landing-notice-foot">
          <button
            type="button"
            className="landing-notice-accept"
            disabled={!agreed}
            onClick={onAccept}
          >
            Đã hiểu
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
