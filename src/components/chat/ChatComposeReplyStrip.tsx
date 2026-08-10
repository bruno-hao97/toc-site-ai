import type { ChatMessage } from '../../services/chatSessionsLocal';
import { buildReplyRef } from '../../services/chatReply';
import ChatMessageReplyCard from './ChatMessageReplyCard';

export default function ChatComposeReplyStrip({
  message,
  agentName,
  agentId,
  onClear,
}: {
  message: ChatMessage;
  agentName: string;
  agentId: string;
  onClear: () => void;
}) {
  const reply = buildReplyRef(message, agentName, agentId);

  return <ChatMessageReplyCard reply={reply} onClear={onClear} variant="compose" />;
}
