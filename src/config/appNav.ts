import type { LucideIcon } from 'lucide-react';
import {
  Clapperboard,
  Compass,
  FolderKanban,
  GitBranch,
  Home,
  Image as ImageIcon,
  Library,
  MessageSquare,
  Mic,
  Music,
} from 'lucide-react';
import type { TranslationKey } from '../i18n';

export interface AppNavItem {
  to: string;
  labelKey: TranslationKey;
  icon: LucideIcon;
  /** NavLink `end` — e.g. `/home` should not match `/home/library`. */
  end?: boolean;
}

export const PRIMARY_NAV: AppNavItem[] = [
  { to: '/home', labelKey: 'nav.home', icon: Home, end: true },
  { to: '/chat', labelKey: 'nav.chat', icon: MessageSquare },
  { to: '/explore', labelKey: 'nav.explore', icon: Compass },
  { to: '/image', labelKey: 'nav.image', icon: ImageIcon },
  { to: '/video', labelKey: 'nav.video', icon: Clapperboard },
  { to: '/workflow', labelKey: 'nav.workflow', icon: GitBranch },
];

export const MORE_NAV: AppNavItem[] = [
  { to: '/home/library', labelKey: 'nav.library', icon: Library },
  { to: '/projects', labelKey: 'nav.projects', icon: FolderKanban },
  { to: '/music', labelKey: 'nav.music', icon: Music },
  { to: '/audio', labelKey: 'nav.audio', icon: Mic },
];

export const ALL_NAV: AppNavItem[] = [...PRIMARY_NAV, ...MORE_NAV];

export function navItemActive(pathname: string, to: string, end?: boolean): boolean {
  if (end) return pathname === to;
  if (to === '/home/library') {
    return pathname === '/home/library' || pathname.startsWith('/home/library/');
  }
  return pathname === to || pathname.startsWith(`${to}/`);
}
