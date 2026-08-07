import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { Bot, Clapperboard, Coins, GitBranch, Image as ImageIcon, Mic, Music } from 'lucide-react';
import { getDisplayUser } from '../../services/authStore';
import { useDisplayCredits } from '../../hooks/useDisplayCredits';
import { magnificSrc } from '../../lib/landingMedia';

const SHORTCUTS: {
  to: string;
  label: string;
  slug: string;
  icon: LucideIcon;
}[] = [
  { to: '/chat', label: 'Chat', slug: 'ai-video-generator', icon: Bot },
  { to: '/image', label: 'Tạo ảnh', slug: 'ai-icon-generator', icon: ImageIcon },
  { to: '/video', label: 'Tạo video', slug: 'ai-video-generator', icon: Clapperboard },
  { to: '/music', label: 'Tạo nhạc', slug: 'video-upscaler', icon: Music },
  { to: '/audio', label: 'Giọng nói', slug: 'text-to-speech', icon: Mic },
  { to: '/workflow', label: 'Workflow', slug: 'spaces', icon: GitBranch },
];

function greetingName(): string {
  const user = getDisplayUser();
  return user.name || user.username || user.email.split('@')[0] || 'bạn';
}

export default function HomeHeroStrip() {
  const { credits } = useDisplayCredits({ refreshOnMount: false });
  const name = greetingName();

  return (
    <section className="home-hero-strip" aria-label="Lối tắt tạo nội dung">
      <div className="home-hero-copy">
        <p className="home-hero-kicker">Trung tâm sáng tạo</p>
        <h1 className="home-hero-title">Xin chào, {name}</h1>
        <Link to="/pricing" className="home-hero-credits">
          <Coins size={15} strokeWidth={1.75} aria-hidden />
          <span>{credits.toLocaleString('vi-VN')} credits</span>
        </Link>
      </div>

      <div className="home-hero-shortcuts">
        {SHORTCUTS.map(({ to, label, slug, icon: Icon }) => (
          <Link key={to} to={to} className="home-hero-shortcut">
            <span className="home-hero-shortcut-thumb">
              <img src={magnificSrc(slug, 320, 320, 70)} alt="" aria-hidden loading="lazy" decoding="async" />
              <span className="home-hero-shortcut-icon">
                <Icon size={18} strokeWidth={1.75} />
              </span>
            </span>
            <span className="home-hero-shortcut-label">{label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
