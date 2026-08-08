import {
  Clapperboard,
  Heart,
  Image as ImageIcon,
  LayoutGrid,
  Mic,
  Music,
} from 'lucide-react';

export type CommunityMediaFilter =
  | 'all'
  | 'video'
  | 'image'
  | 'tts'
  | 'music'
  | 'favorite';

const FILTERS: {
  id: CommunityMediaFilter;
  label: string;
  icon: typeof LayoutGrid;
}[] = [
  { id: 'all', label: 'Tất cả', icon: LayoutGrid },
  { id: 'video', label: 'Video', icon: Clapperboard },
  { id: 'image', label: 'Ảnh', icon: ImageIcon },
  { id: 'tts', label: 'Âm thanh', icon: Mic },
  { id: 'music', label: 'Nhạc', icon: Music },
  { id: 'favorite', label: 'Yêu thích', icon: Heart },
];

interface HomeCommunityFiltersProps {
  value: CommunityMediaFilter;
  onChange: (value: CommunityMediaFilter) => void;
}

export default function HomeCommunityFilters({ value, onChange }: HomeCommunityFiltersProps) {
  return (
    <div className="home-community-filters" role="tablist" aria-label="Lọc tác phẩm cộng đồng">
      {FILTERS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={value === id}
          className={`home-community-filter${value === id ? ' active' : ''}`}
          onClick={() => onChange(id)}
        >
          <Icon size={14} strokeWidth={1.75} aria-hidden />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
