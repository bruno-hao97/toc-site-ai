import { Check } from 'lucide-react';

export default function ComposerSelectCircle({
  selected,
  onToggle,
  className = '',
}: {
  selected: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`composer-select-circle${selected ? ' selected' : ''}${className ? ` ${className}` : ''}`}
      aria-pressed={selected}
      aria-label={selected ? 'Bỏ chọn' : 'Chọn'}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
    >
      {selected && <Check size={13} strokeWidth={3} />}
    </button>
  );
}
