const FATAL_RE = /Fatal error|Uncaught|Stack trace|<\s*html|<\s*b>/i;
const TOKEN_EXPIRED_RE = /token đã hết hạn|token expired|phiên đăng nhập/i;

export function humanizePlatformError(
  text: string,
  status: number,
  parsedMessage?: string,
): string {
  if (parsedMessage?.trim()) {
    const msg = parsedMessage.trim();
    if (!FATAL_RE.test(msg)) return msg;
  }

  if (TOKEN_EXPIRED_RE.test(text)) {
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  }
  if (FATAL_RE.test(text)) {
    return 'Máy chủ tạm thời gặp sự cố. Vui lòng thử lại sau.';
  }
  if (status === 401 || status === 403) {
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  }
  if (status >= 500) {
    return 'Máy chủ đang bận. Vui lòng thử lại sau.';
  }

  const trimmed = text.trim();
  if (trimmed.length > 0 && trimmed.length <= 160 && !FATAL_RE.test(trimmed)) {
    return trimmed;
  }
  return 'Không thực hiện được yêu cầu. Vui lòng thử lại.';
}

export function parsePlatformJson<T extends { success?: boolean; message?: string }>(
  text: string,
  status: number,
): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(humanizePlatformError(text, status));
  }
}
