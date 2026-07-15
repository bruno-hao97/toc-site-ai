/** Lọc phần kỹ thuật khỏi bubble — chỉ hiển thị tóm tắt user-facing (giống 79AI). */

function stripFromFirstCodeFence(text: string): string {
  const idx = text.indexOf('```');
  if (idx === -1) return text;
  return text.slice(0, idx);
}

function stripMarkdownSections(text: string): string {
  return text
    .replace(/^##\s+[^\n]+\n[\s\S]*?(?=^##\s+|$)/gm, '')
    .replace(/^##\s+.*$/gm, '')
    .replace(/^\*\*Action dự kiến\*\*[\s\S]*?(?=\n\n|$)/gim, '')
    .replace(/^Action dự kiến[\s\S]*?(?=\n\n|$)/gim, '');
}

function stripTechnicalLines(text: string): string {
  return text
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (/^Add\s+\w+(\s*\|)/i.test(t)) return false;
      if (/^Connect\s+\S+\s*(->|→)/i.test(t)) return false;
      if (/^Update\s+\S+/i.test(t)) return false;
      if (/^Focus\s+(viewport|view|canvas)/i.test(t)) return false;
      if (/^Delete\s+node:/i.test(t)) return false;
      if (/^Dòng action/i.test(t)) return false;
      if (/^`gommo_action`/i.test(t)) return false;
      if (/^Ghi chú:/i.test(t)) return false;
      if (/^\{[\s\S]*"capabilityId"/.test(t)) return false;
      return true;
    })
    .join('\n');
}

/** Trả về text ngắn để render bubble; giữ nguyên raw `content` cho parser. */
export function formatAgentDisplayContent(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith('⚠️') || trimmed.startsWith('(')) return trimmed;

  let text = stripFromFirstCodeFence(trimmed);
  text = text.replace(/```[\s\S]*?```/g, '');
  text = stripMarkdownSections(text);
  text = stripTechnicalLines(text);
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  if (text) return text;

  const firstBlock = stripFromFirstCodeFence(trimmed)
    .split('\n\n')
    .map((p) => p.trim())
    .find((p) => p.length > 0 && !p.startsWith('##'));
  return firstBlock ?? 'Đã cập nhật workflow theo yêu cầu của bạn.';
}
