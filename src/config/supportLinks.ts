import type { LucideIcon } from 'lucide-react';
import { Coins, MessageCircle, Phone, Share2, Users } from 'lucide-react';

export const SUPPORT_ZALO_GROUP_URL = 'https://zalo.me/g/pihsuh324';
export const SUPPORT_FACEBOOK_GROUP_URL = 'https://www.facebook.com/groups/smartai.vn';

export interface SupportLink {
  label: string;
  href: string;
  icon: LucideIcon;
  external: boolean;
}

export const SUPPORT_LINKS: SupportLink[] = [
  { label: 'Nhóm Zalo', href: SUPPORT_ZALO_GROUP_URL, icon: Users, external: true },
  { label: 'Zalo hỗ trợ', href: SUPPORT_ZALO_GROUP_URL, icon: Phone, external: true },
  { label: 'Fanpage', href: SUPPORT_FACEBOOK_GROUP_URL, icon: Share2, external: true },
  { label: 'Nạp tiền & bảng giá', href: '/pricing', icon: Coins, external: false },
  { label: 'Chat hỗ trợ', href: '/chat', icon: MessageCircle, external: false },
];
