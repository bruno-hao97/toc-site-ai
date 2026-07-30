export const CHAT_SUGGESTIONS = [
  'Viết kịch bản chatbot chăm sóc khách hàng 24/7 cho shop thời trang online.',
  'Tạo moodboard visual cho thương hiệu lifestyle cao cấp, tone ấm, minimal.',
  'Đề xuất hashtag và trend cho TikTok Shop bán mỹ phẩm organic.',
  'Tạo storyboard video giới thiệu app mobile fintech, 4 cảnh, 30 giây.',
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
