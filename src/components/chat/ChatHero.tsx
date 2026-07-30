import type { LucideIcon } from 'lucide-react';
import { CodeXml, Image, Palette, Video, Workflow } from 'lucide-react';
import type { ChatAiModel } from '../../services/chatAiModels';

interface Props {
  model: ChatAiModel;
}

const HERO_ICONS: { Icon?: LucideIcon; bg: string; rotate: number }[] = [
  { Icon: Image, bg: '#b6f4ff', rotate: -8 },
  { Icon: Video, bg: '#ffd3ed', rotate: -4 },
  { Icon: Palette, bg: '#e8d5ff', rotate: -2 },
  { Icon: Workflow, bg: '#c7ff44', rotate: 0 },
  { Icon: CodeXml, bg: '#ffe59e', rotate: 4 },
  { bg: '#ffffff', rotate: 8 },
];

export default function ChatHero({ model }: Props) {
  return (
    <div className="chat-hero">
      <div className="chat-hero-icons" aria-hidden="true">
        {HERO_ICONS.map((item, i) => (
          <span
            key={i}
            className="chat-hero-icon"
            style={{ background: item.bg, transform: `rotate(${item.rotate}deg)` }}
          >
            {item.Icon && <item.Icon size={20} strokeWidth={2} />}
          </span>
        ))}
      </div>
      <p className="chat-hero-kicker">KHÔNG GIAN AI</p>
      <h1 className="chat-hero-title">
        <span className="chat-hero-title-line">BIẾN Ý TƯỞNG THÀNH</span>
        <span className="chat-hero-title-line">HIỆN THỰC VỚI AI</span>
      </h1>
      <p className="chat-hero-sub">
        Sáng tạo không giới hạn. Hỗ trợ bởi <strong>{model.name}</strong>.
      </p>
    </div>
  );
}
