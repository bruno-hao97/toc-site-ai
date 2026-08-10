import type { ChatMessage, ChatMessageReplyRef } from './chatSessionsLocal';
import { stripChatDisplayText } from './stripChatMarkdown';

export function excerptChatText(content: string, maxLen = 280): string {
  const plain = stripChatDisplayText(content);
  return plain.length > maxLen ? `${plain.slice(0, maxLen)}…` : plain;
}

export function buildReplyRef(
  message: ChatMessage,
  agentName: string,
  agentId: string,
): ChatMessageReplyRef {
  return {
    messageId: message.id,
    role: message.role,
    excerpt: excerptChatText(message.content, 280),
    agentName: message.role === 'assistant' ? agentName : undefined,
    agentId: message.role === 'assistant' ? agentId : undefined,
  };
}

export function buildReplyPromptText(content: string, reply: ChatMessageReplyRef): string {
  const label = reply.agentName ?? (reply.role === 'assistant' ? 'AGI' : 'bạn');
  const prefix = `[Phản hồi tin ${label}: "${reply.excerpt}"]`;
  const trimmed = content.trim();
  return trimmed ? `${prefix}\n\n${trimmed}` : prefix;
}

export function messagePromptText(message: ChatMessage): string {
  if (!message.replyTo) return message.content;
  return buildReplyPromptText(message.content, message.replyTo);
}

export function replyMentionLabel(reply: ChatMessageReplyRef): string {
  if (reply.role === 'assistant') {
    const name = reply.agentName ?? 'AGI';
    return reply.agentId ? `@${name} (${reply.agentId})` : `@${name}`;
  }
  return '@Bạn';
}

export function replyTargetLabel(reply: ChatMessageReplyRef): string {
  if (reply.role === 'assistant') {
    const name = reply.agentName ?? 'AGI';
    return reply.agentId ? `${name} (${reply.agentId})` : name;
  }
  return 'Bạn';
}
