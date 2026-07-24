import { LayoutGrid, LayoutList, RectangleHorizontal, Grid3x3 } from 'lucide-react';

export type HomeLibLayout = 'list' | 'wide' | 'grid2' | 'grid3';

const OPTIONS: {
  id: HomeLibLayout;
  label: string;
  Icon: typeof LayoutList;
}[] = [
  { id: 'list', label: 'Danh sách', Icon: LayoutList },
  { id: 'wide', label: 'Thẻ rộng', Icon: RectangleHorizontal },
  { id: 'grid2', label: 'Lưới 2 cột', Icon: LayoutGrid },
  { id: 'grid3', label: 'Lưới 3 cột', Icon: Grid3x3 },
];

export default function HomeLibLayoutSwitcher({
  value,
  onChange,
}: {
  value: HomeLibLayout;
  onChange: (layout: HomeLibLayout) => void;
}) {
  return (
    <div className="home-lib-switcher" role="group" aria-label="Chế độ hiển thị">
      {OPTIONS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className={`home-lib-switcher-btn${value === id ? ' active' : ''}`}
          aria-label={label}
          aria-pressed={value === id}
          title={label}
          onClick={() => onChange(id)}
        >
          <Icon size={15} strokeWidth={value === id ? 2.4 : 2} />
        </button>
      ))}
    </div>
  );
}
