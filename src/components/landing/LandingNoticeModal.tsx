import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Coins,
  Link2,
  MessageCircle,
  Phone,
  Share2,
  Users,
  X,
} from 'lucide-react';
import BrandLogo from '../BrandLogo';
import { contactPhoneLine } from '../../lib/brand';

interface Props {
  open: boolean;
  onAccept: () => void;
}

const GO_URL = 'https://toctoc.vn/go/';

const QUICK_LINKS = [
  { label: 'Nhóm Zalo', href: GO_URL, icon: Users, external: true },
  { label: 'Zalo hỗ trợ', href: GO_URL, icon: Phone, external: true },
  { label: 'Fanpage', href: GO_URL, icon: Share2, external: true },
  { label: 'Nạp tiền & bảng giá', href: '/pricing', icon: Coins, external: false },
  { label: 'Kết nối API', href: GO_URL, icon: Link2, external: true },
  { label: 'Chat hỗ trợ', href: GO_URL, icon: MessageCircle, external: true },
] as const;

const PROHIBITED_ITEMS = [
  'Nội dung 18+, khiêu dâm, bạo lực hoặc phản cảm',
  'Thông tin nhạy cảm, lừa đảo, giả mạo hoặc vi phạm pháp luật',
  'Cá cược, cờ bạc và các hành vi trái quy định cộng đồng',
];

export default function LandingNoticeModal({ open, onAccept }: Props) {
  useEffect(() => {
    if (!open) return;
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
        <header className="landing-notice-head">
          <h2 id="landing-notice-title">Thông báo</h2>
          <button
            type="button"
            className="landing-notice-close"
            aria-label="Đóng"
            onClick={onAccept}
          >
            <X size={18} />
          </button>
        </header>

        <div className="landing-notice-body">
          <div className="landing-notice-brand">
            <BrandLogo to={null} />
            <span className="landing-notice-brand-text">Thông báo từ Pro.agi.vn</span>
          </div>

          <h3 className="landing-notice-title">Kết nối nhanh, sử dụng AI an toàn</h3>
          <p className="landing-notice-lead">
            Hỗ trợ cộng đồng, bảng giá và tài liệu API.
          </p>

          <div className="landing-notice-links">
            {QUICK_LINKS.map(({ label, href, icon: Icon, external }) => (
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

          <section className="landing-notice-warn" aria-labelledby="landing-notice-warn-title">
            <div className="landing-notice-warn-head">
              <AlertTriangle size={22} />
              <h4 id="landing-notice-warn-title">NGHIÊM CẤM VI PHẠM</h4>
            </div>
            <ul>
              {PROHIBITED_ITEMS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="landing-notice-warn-foot">
              {contactPhoneLine('Liên hệ hỗ trợ')} · Tuân thủ quy định để sử dụng dịch vụ ổn định.
            </p>
          </section>
        </div>

        <footer className="landing-notice-foot">
          <button type="button" className="landing-notice-accept" onClick={onAccept}>
            Đã hiểu
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
