import { CHAT_SUGGESTIONS } from '../../services/chatPageData';

interface Props {
  onSuggestion: (text: string) => void;
}

export default function ChatSuggestions({ onSuggestion }: Props) {
  return (
    <section className="chat-suggestions" aria-label="Gợi ý cho bạn">
      <span className="chat-suggestions-kicker">GỢI Ý</span>
      <h2 className="chat-suggestions-title">GỢI Ý CHO BẠN</h2>
      <ul className="chat-suggestions-list">
        {CHAT_SUGGESTIONS.map((text) => (
          <li key={text}>
            <button type="button" className="chat-suggestion-card" onClick={() => onSuggestion(text)}>
              {text}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
