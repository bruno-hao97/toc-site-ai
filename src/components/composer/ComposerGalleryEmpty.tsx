import { Image as ImageIcon, Sparkles } from 'lucide-react';

interface Props {
  title: string;
  description?: string;
  showFocus?: boolean;
  focusLabel?: string;
}

export function focusComposerPrompt() {
  const side = document.querySelector('.composer-side');
  side?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  window.setTimeout(() => {
    const fields = document.querySelectorAll<HTMLTextAreaElement>(
      '.composer-side textarea.composer-textarea',
    );
    for (const ta of fields) {
      if (ta.offsetParent !== null && !ta.classList.contains('composer-shot-input')) {
        ta.focus();
        break;
      }
    }
  }, 280);
}

export default function ComposerGalleryEmpty({
  title,
  description,
  showFocus = true,
  focusLabel = 'Mở panel tạo',
}: Props) {
  return (
    <div className="composer-gallery-empty">
      <div className="composer-gallery-empty-icon" aria-hidden>
        <Sparkles size={26} strokeWidth={1.5} />
      </div>
      <h2 className="composer-gallery-empty-title">{title}</h2>
      {description ? <p className="composer-gallery-empty-desc">{description}</p> : null}
      {showFocus ? (
        <div className="composer-gallery-empty-actions">
          <button
            type="button"
            className="composer-gallery-empty-btn composer-gallery-empty-btn--primary"
            onClick={focusComposerPrompt}
          >
            <ImageIcon size={16} />
            {focusLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
