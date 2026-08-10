import type { ReactNode } from 'react';
import { CHAT_SUGGESTIONS } from '../../services/chatPageData';
import { useStackedSuggestionTypewriter } from '../../hooks/useStackedSuggestionTypewriter';
import TypewriterCursor from './TypewriterCursor';

interface Props {
  onSuggestion: (text: string) => void;
}

export default function ChatSuggestions({ onSuggestion }: Props) {
  const { completedLines, activeLineIndex, activeText, showCursor } =
    useStackedSuggestionTypewriter(CHAT_SUGGESTIONS);

  return (
    <section className="chat-suggestions" aria-label="Gợi ý cho bạn">
      <span className="chat-suggestions-kicker">GỢI Ý</span>
      <h2 className="chat-suggestions-title">GỢI Ý CHO BẠN</h2>
      <ul className="chat-suggestions-list">
        {CHAT_SUGGESTIONS.map((full, index) => {
          const doneText = completedLines[index];
          const isDone = doneText != null && doneText.length > 0;
          const isActive = index === activeLineIndex && !isDone;

          let content: ReactNode;
          if (isDone) {
            content = doneText;
          } else if (isActive) {
            content = (
              <>
                {activeText || '\u00A0'}
                {showCursor && <TypewriterCursor />}
              </>
            );
          } else {
            content = <span className="chat-suggestion-card-idle" aria-hidden />;
          }

          const stateClass = isDone
            ? ' chat-suggestion-card--done'
            : isActive
              ? ' chat-suggestion-card--active'
              : ' chat-suggestion-card--pending';

          return (
            <li key={full}>
              <button
                type="button"
                className={`chat-suggestion-card${stateClass}`}
                onClick={() => onSuggestion(full)}
                aria-label={full}
              >
                {content}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
