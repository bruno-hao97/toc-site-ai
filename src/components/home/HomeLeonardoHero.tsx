import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { Bot, Clapperboard, Coins, GitBranch, Image as ImageIcon, Mic, Music } from 'lucide-react';
import HomeQuickCreateBar from '../HomeQuickCreateBar';
import { getDisplayUser } from '../../services/authStore';
import { useDisplayCredits } from '../../hooks/useDisplayCredits';
import { LANDING_MEDIA, magnificSrc } from '../../lib/landingMedia';

const CHIPS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/chat', label: 'Chat', icon: Bot },
  { to: '/image', label: 'Tạo ảnh', icon: ImageIcon },
  { to: '/video', label: 'Tạo video', icon: Clapperboard },
  { to: '/music', label: 'Tạo nhạc', icon: Music },
  { to: '/audio', label: 'Giọng nói', icon: Mic },
  { to: '/workflow', label: 'Workflow', icon: GitBranch },
];

function greetingName(): string {
  const user = getDisplayUser();
  return user.name || user.username || user.email.split('@')[0] || 'bạn';
}

export default function HomeLeonardoHero() {
  const { credits } = useDisplayCredits({ refreshOnMount: false });
  const name = greetingName();
  const heroBg = magnificSrc(LANDING_MEDIA.hero, 1920, 1080, 70);

  return (
    <section className="home-leonardo-hero" aria-label="Tạo nội dung nhanh">
      <div
        className="home-leonardo-hero-bg"
        style={{ backgroundImage: `url(${heroBg})` }}
        aria-hidden
      />
      <div className="home-leonardo-hero-overlay" aria-hidden />

      <div className="home-leonardo-hero-inner">
        <header className="home-leonardo-copy">
          <p className="home-leonardo-kicker">Trung tâm sáng tạo</p>
          <h1 className="home-leonardo-title">Sáng tạo không giới hạn</h1>
          <p className="home-leonardo-greet">
            Xin chào, <strong>{name}</strong>
            <Link to="/pricing" className="home-leonardo-credits">
              <Coins size={14} strokeWidth={1.75} aria-hidden />
              <span>{credits.toLocaleString('vi-VN')} credits</span>
            </Link>
          </p>
        </header>

        <div className="home-leonardo-create">
          <div className="home-leonardo-create-border" aria-hidden />
          <HomeQuickCreateBar variant="hero" />
        </div>

        <nav className="home-leonardo-chips" aria-label="Lối tắt studio">
          {CHIPS.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className="home-leonardo-chip">
              <span className="home-leonardo-chip-icon">
                <Icon size={22} strokeWidth={1.75} aria-hidden />
              </span>
              <span className="home-leonardo-chip-label">{label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}
