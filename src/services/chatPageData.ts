export const CHAT_SUGGESTIONS = [
  'Viết kịch bản quảng cáo ngắn cho TikTok/Reels…',
  'Viết press release ra mắt sản phẩm mới…',
  'Viết kịch bản livestream bán hàng 15 phút…',
  'Gợi ý ý tưởng video marketing cho sản phẩm mới…',
] as const;

export const CHAT_COMPOSE_PLACEHOLDERS = [
  'Bạn muốn hỏi, tạo app, hay xây dựng ý tưởng gì hôm nay?',
  'Viết kịch bản quảng cáo ngắn cho TikTok/Reels…',
  'Viết press release ra mắt sản phẩm mới…',
  'Gợi ý ý tưởng video marketing cho sản phẩm mới…',
] as const;

export type ChatPillAction =
  | { type: 'navigate'; href: string }
  | { type: 'model'; modelId: string }
  | { type: 'prompt'; text: string };

export interface ChatPill {
  id: string;
  label: string;
  action: ChatPillAction;
}

export const CHAT_PILLS: ChatPill[] = [
  { id: 'image', label: 'Tạo ảnh', action: { type: 'navigate', href: '/image' } },
  { id: 'video', label: 'Tạo video', action: { type: 'navigate', href: '/video' } },
  { id: 'workflow', label: 'Workflow', action: { type: 'navigate', href: '/workflow' } },
  { id: 'code', label: 'Code', action: { type: 'model', modelId: 'deepseek-v4-pro' } },
  {
    id: 'design',
    label: 'Design',
    action: {
      type: 'prompt',
      text: 'Gợi ý concept thiết kế UI landing page SaaS AI, dark mode, hiện đại.',
    },
  },
];
