import { isLoggedIn } from '../services/authStore';

export const NAV_LINKS = [
  { href: '#models', label: 'Mô hình' },
  { href: '#multimodal', label: 'Tiện ích' },
  { href: '#pricing', label: 'Bảng giá' },
  { href: '#features', label: 'API' },
] as const;

export function appEntryPath(): string {
  return isLoggedIn() ? '/home' : '/login';
}
