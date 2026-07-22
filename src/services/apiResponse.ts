/** Tiện ích parse response API: trả JSON sạch, che HTML 404/502 khỏi UI. */

function looksLikeHtml(text: string): boolean {
  const head = text.trimStart().slice(0, 200).toLowerCase();
  return head.startsWith('<!doctype') || head.startsWith('<html') || head.includes('<head');
}

export interface ApiJsonError extends Error {
  status: number;
  /** True khi server trả HTML (thường là 404/502 của web server, không phải API). */
  isHtml: boolean;
}

function makeError(message: string, status: number, isHtml: boolean): ApiJsonError {
  const err = new Error(message) as ApiJsonError;
  err.status = status;
  err.isHtml = isHtml;
  return err;
}

/** Thông báo thân thiện khi endpoint không sẵn sàng (chưa deploy Node / sai proxy). */
export function apiUnavailableMessage(status: number): string {
  if (status === 404) {
    return 'Dịch vụ thanh toán chưa sẵn sàng trên máy chủ (404). Vui lòng thử lại sau hoặc liên hệ hỗ trợ.';
  }
  if (status === 502 || status === 503 || status === 504) {
    return 'Máy chủ thanh toán tạm thời không phản hồi. Vui lòng thử lại sau ít phút.';
  }
  return `Không kết nối được dịch vụ thanh toán (HTTP ${status}).`;
}

/**
 * Đọc response và parse JSON. Nếu server trả HTML (404/502…) thì ném lỗi
 * với message thân thiện thay vì dump nguyên trang HTML ra giao diện.
 */
export async function readJsonResponse<T = unknown>(res: Response): Promise<T> {
  const text = await res.text();

  if (looksLikeHtml(text)) {
    throw makeError(apiUnavailableMessage(res.status), res.status, true);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    const trimmed = text.trim();
    if (!trimmed) {
      throw makeError(apiUnavailableMessage(res.status), res.status, false);
    }
    throw makeError(trimmed.slice(0, 200), res.status, false);
  }

  return raw as T;
}
