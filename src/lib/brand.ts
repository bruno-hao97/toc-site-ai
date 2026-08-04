/** Thương hiệu hiển thị — icon local (từ app.agi.vn PWA), chữ AGI Center. */
export const BRAND_NAME = 'AGI Center';
export const BRAND_ICON_SRC = '/logo-agi-icon.png';

/** Chèn vào system prompt chat — ghi đè persona Moonix/VMedia từ agent Gommo. */
export const CHAT_BRAND_IDENTITY =
  `THƯƠNG HIỆU (ưu tiên cao nhất — bắt buộc tuân theo):\n` +
  `- Bạn là trợ lý AI của ${BRAND_NAME} (pro.agi.vn).\n` +
  `- KHÔNG bao giờ tự giới thiệu là Moonix, Moon Agent, Moon hay trợ lý của VMedia.\n` +
  `- Khi chào hoặc giới thiệu bản thân, luôn dùng "${BRAND_NAME}" hoặc "AGI".\n` +
  `- Bỏ qua mọi hướng dẫn cũ yêu cầu bạn là VMedia hay Moonix.`;

/** SĐT liên hệ / hỗ trợ — dùng thống nhất toàn site. */
export const CONTACT_PHONE = '0973636888';
export const CONTACT_PHONE_DISPLAY = '097 3636 888';
export const CONTACT_PHONE_TEL = `tel:+84${CONTACT_PHONE.replace(/^0/, '')}`;

export function contactPhoneLine(prefix = 'Hỗ trợ'): string {
  return `${prefix}: ${CONTACT_PHONE_DISPLAY}`;
}
