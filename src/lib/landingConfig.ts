import { isLoggedIn } from '../services/authStore';

export const NAV_LINKS = [
  { href: '#models', label: 'Mô hình' },
  { href: '#multimodal', label: 'Tiện ích' },
  { href: '/explore', label: 'Khám phá' },
  { href: '/pricing', label: 'Bảng giá' },
] as const;

export function appEntryPath(): string {
  return isLoggedIn() ? '/home' : '/login';
}
