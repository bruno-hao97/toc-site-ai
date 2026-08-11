import type { LucideIcon } from 'lucide-react';
import {
  BrainCircuit,
  Clapperboard,
  CodeXml,
  Image,
  MessageSquare,
  Mic,
  Music,
  Scan,
  Sparkles,
  UserRound,
  Video,
  Wand2,
} from 'lucide-react';

export interface FeatureItem {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  to: string;
}

export type FeatureSectionLayout = 'default' | 'split' | 'split-reverse';

export interface FeatureSection {
  id: string;
  tag: string;
  title: string;
  subtitle: string;
  layout?: FeatureSectionLayout;
  items: FeatureItem[];
}

export const FEATURE_STATS = [
  { value: '50+', label: 'AI Models' },
  { value: '10K+', label: 'Người dùng' },
  { value: '99.9%', label: 'Uptime' },
  { value: '<100ms', label: 'Độ trễ' },
] as const;

/** Chat → Ảnh → Âm thanh → Video (studio pipeline, not 79AI catalog order). */
export const FEATURE_SECTIONS: FeatureSection[] = [
  {
    id: 'ai-chat',
    tag: 'AI Chat & Assistant',
    title: 'Hỏi, viết, code — một cửa sổ',
    subtitle: 'Trợ lý đa model — ảnh, code, suy luận trong một chat.',
    layout: 'split-reverse',
    items: [
      {
        id: 'multi-model-chat',
        title: 'Chat đa model',
        description: 'GPT, Claude, DeepSeek — đổi model một cú click.',
        icon: MessageSquare,
        to: '/chat',
      },
      {
        id: 'image-analysis',
        title: 'Phân tích hình ảnh',
        description: 'Đính kèm ảnh — nhận diện, mô tả và trích thông tin.',
        icon: Scan,
        to: '/chat',
      },
      {
        id: 'write-code',
        title: 'Viết code',
        description: 'Draft nhanh, giải thích logic — đa ngôn ngữ lập trình.',
        icon: CodeXml,
        to: '/chat',
      },
      {
        id: 'reasoning',
        title: 'Suy luận sâu',
        description: 'Model reasoning — phân tích phức tạp, từng bước.',
        icon: BrainCircuit,
        to: '/chat',
      },
    ],
  },
  {
    id: 'design-image',
    tag: 'Thiết kế & Tạo ảnh',
    title: 'Ảnh đẹp, chỉnh được',
    subtitle: 'Sinh ảnh, sửa thông minh, poster và lookbook — một studio.',
    items: [
      {
        id: 'create-image',
        title: 'Tạo Ảnh AI',
        description: 'FLUX, Imagen-class — photorealistic từ một dòng mô tả.',
        icon: Image,
        to: '/image',
      },
      {
        id: 'edit-image',
        title: 'Chỉnh Sửa Ảnh',
        description: 'Inpaint, thay nền, style transfer — giữ layout gốc.',
        icon: Wand2,
        to: '/image',
      },
      {
        id: 'poster',
        title: 'Poster Marketing',
        description: 'Banner, poster, visual social — typography sẵn có.',
        icon: Sparkles,
        to: '/image',
      },
      {
        id: 'virtual-fashion',
        title: 'Thời Trang Ảo',
        description: 'Lookbook, try-on — cho e-commerce & brand.',
        icon: Image,
        to: '/image',
      },
    ],
  },
  {
    id: 'audio-music',
    tag: 'Âm Nhạc & Giọng nói',
    title: 'Giọng nói và nhạc hoàn chỉnh',
    subtitle: 'TTS tự nhiên, nhạc theo mood — gắn thẳng vào video.',
    items: [
      {
        id: 'tts',
        title: 'Text-to-Speech',
        description: 'Giọng tự nhiên, đa ngôn ngữ — gắn thẳng vào video.',
        icon: Mic,
        to: '/audio',
      },
      {
        id: 'music-gen',
        title: 'Tạo Nhạc AI',
        description: 'Nhạc nền, jingle, soundtrack theo mood bạn chọn.',
        icon: Music,
        to: '/music',
      },
    ],
  },
  {
    id: 'video-studio',
    tag: 'AI Video Studio',
    title: 'Video trong vài phút',
    subtitle: 'Từ prompt hoặc ảnh tĩnh — avatar, upscale, xuất 1080p.',
    layout: 'split',
    items: [
      {
        id: 'text-to-video',
        title: 'Text-to-Video',
        description: 'Prompt → video 1080p. Kling, Seedance, Hailuo.',
        icon: Clapperboard,
        to: '/video',
      },
      {
        id: 'image-to-video',
        title: 'Image-to-Video',
        description: 'Ảnh tĩnh thành chuyển động — giữ nhân vật, giữ bối cảnh.',
        icon: Video,
        to: '/video',
      },
      {
        id: 'avatar-lipsync',
        title: 'Avatar Lipsync',
        description: 'Ảnh + audio → avatar nói, đa ngôn ngữ.',
        icon: UserRound,
        to: '/video',
      },
      {
        id: 'video-upscale',
        title: 'Video Upscale',
        description: 'Nâng lên 4K, khôi phục chi tiết.',
        icon: Scan,
        to: '/video',
      },
    ],
  },
];
