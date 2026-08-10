import type { LucideIcon } from 'lucide-react';
import { CodeXml, Image, Palette, Video, Workflow } from 'lucide-react';
import type { ChatAiModel } from '../../services/chatAiModels';

interface Props {
  model: ChatAiModel;
}

const HERO_ICONS: { Icon?: LucideIcon; rotate: number; empty?: boolean }[] = [
  { Icon: Image, rotate: -8 },
  { Icon: Video, rotate: -4 },
  { Icon: Palette, rotate: -2 },
  { Icon: Workflow, rotate: 0 },
  { Icon: CodeXml, rotate: 4 },
];

export default function ChatHero({ model }: Props) {
  return (
    <div className="chat-hero">
      <div className="chat-hero-icons" aria-hidden="true">
        {HERO_ICONS.map((item, i) => (
          <span
            key={i}
            className={`chat-hero-icon${item.empty ? ' chat-hero-icon--empty' : ''}`}
            style={{ transform: `rotate(${item.rotate}deg)` }}
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
