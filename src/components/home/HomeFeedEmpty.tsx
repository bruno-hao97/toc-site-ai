import { Link } from 'react-router-dom';
import { Clapperboard, Image as ImageIcon, Sparkles } from 'lucide-react';

interface Props {
  title: string;
  description?: string;
  showCreate?: boolean;
}

function focusQuickCreate() {
  const dock = document.querySelector('.home-quick-create-dock');
  dock?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  window.setTimeout(() => {
    document.querySelector<HTMLTextAreaElement>('.qc-prompt')?.focus();
  }, 320);
}

export default function HomeFeedEmpty({ title, description, showCreate = true }: Props) {
  return (
    <div className="home-feed-empty">
      <div className="home-feed-empty-icon" aria-hidden>
        <Sparkles size={28} strokeWidth={1.5} />
      </div>
      <h2 className="home-feed-empty-title">{title}</h2>
      {description ? <p className="home-feed-empty-desc">{description}</p> : null}
      {showCreate ? (
        <div className="home-feed-empty-actions">
          <Link to="/video" className="home-feed-empty-btn home-feed-empty-btn--primary">
            <Clapperboard size={16} />
            Tạo video
          </Link>
          <Link to="/image" className="home-feed-empty-btn">
            <ImageIcon size={16} />
            Tạo ảnh
          </Link>
          <button type="button" className="home-feed-empty-btn home-feed-empty-btn--ghost" onClick={focusQuickCreate}>
            Tạo nhanh
          </button>
        </div>
      ) : null}
    </div>
  );
}
