import { BRAND_NAME } from '../lib/brand';

/** Gỡ cú pháp markdown — chat UI render plain text, không parse MD. */
export function stripChatMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

const MOON_VMEDIA_GREETING_RE =
  /(?:^|\n)\s*(?:Xin chào|Hello|Hi|Chào bạn)!?\s*Mình là\s+Moon,?\s*trợ lý AI(?:\s+của)?\s+VMedia\.?\s*/gi;

const MOON_VMEDIA_INTRO_RE =
  /Mình là\s+Moon,?\s*trợ lý AI(?:\s+của)?\s+VMedia\.?\s*/gi;

/** Gỡ persona Moon/VMedia từ agent Gommo — thay bằng thương hiệu AGI Center. */
export function stripMoonVmediaBranding(text: string): string {
  let out = text.replace(MOON_VMEDIA_GREETING_RE, (m) => {
    const greeting = m.match(/(?:Xin chào|Hello|Hi|Chào bạn)/i)?.[0] ?? 'Xin chào';
    return `\n${greeting}! `;
  });
  out = out.replace(MOON_VMEDIA_INTRO_RE, '');
  out = out.replace(/(?:I am|I'm)\s+Moon,?\s*(?:the\s+)?VMedia\s+AI\s+assistant\.?\s*/gi, '');
  out = out.replace(/trợ lý AI của VMedia/gi, `trợ lý AI của ${BRAND_NAME}`);
  out = out.replace(/VMedia\s+AI\s+assistant/gi, `${BRAND_NAME} assistant`);
  out = out.replace(/\bVMedia\b/g, BRAND_NAME);
  out = out.replace(/\bMoon Agent\b/gi, BRAND_NAME);
  out = out.replace(/\bMoonix\b/gi, BRAND_NAME);
  out = out.replace(/\bmình là Moon\b/gi, `mình là trợ lý AI của ${BRAND_NAME}`);
  out = out.replace(/\bMoon\b(?=\s*[,—–-]?\s*trợ lý)/gi, BRAND_NAME);
  out = out.replace(/ {2,}/g, ' ');
  out = out.replace(/\n{3,}/g, '\n\n');
  return out.trim();
}

/** Markdown + branding — dùng khi render tin assistant trong UI. */
export function stripChatDisplayText(text: string): string {
  return stripMoonVmediaBranding(stripChatMarkdown(text));
}
