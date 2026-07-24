/** Thương hiệu hiển thị — icon local (từ app.agi.vn PWA), chữ AGI Center. */
export const BRAND_NAME = 'AGI Center';
export const BRAND_ICON_SRC = '/logo-agi-icon.png';

/** SĐT liên hệ / hỗ trợ — dùng thống nhất toàn site. */
export const CONTACT_PHONE = '0973636888';
export const CONTACT_PHONE_DISPLAY = '097 3636 888';
export const CONTACT_PHONE_TEL = `tel:+84${CONTACT_PHONE.replace(/^0/, '')}`;

export function contactPhoneLine(prefix = 'Hỗ trợ'): string {
  return `${prefix}: ${CONTACT_PHONE_DISPLAY}`;
}
