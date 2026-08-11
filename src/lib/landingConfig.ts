import { isLoggedIn } from '../services/authStore';

export const NAV_LINKS = [
  { href: '/features', label: 'Tính năng' },
  { href: '/models', label: 'Models' },
  { href: '/explore', label: 'Khám phá' },
  { href: '/pricing', label: 'Bảng giá' },
] as const;

export function appEntryPath(): string {
  return isLoggedIn() ? '/home' : '/login';
}
