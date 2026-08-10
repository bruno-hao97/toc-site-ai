import { useEffect, useState } from 'react';

export default function ChatReasoningIndicator() {
  const [elapsed, setElapsed] = useState(1);

  useEffect(() => {
    const started = Date.now();
    const tick = () => {
      setElapsed(Math.max(1, Math.ceil((Date.now() - started) / 1000)));
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="chat-reasoning" role="status" aria-live="polite">
      <span className="chat-reasoning-row">
        <span className="chat-reasoning-dot" aria-hidden />
        <span className="chat-reasoning-label">Mô hình đang suy luận…</span>
      </span>
      <span className="chat-reasoning-time">{elapsed}s</span>
    </div>
  );
}
