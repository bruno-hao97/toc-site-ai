export interface LandingFeaturedModel {
  id: string;
  name: string;
  tag: string;
  description: string;
}

/** Fallback khi public-models API chưa sẵn sàng (local / lỗi mạng). */
export const LANDING_FEATURED_MODELS: LandingFeaturedModel[] = [
  {
    id: 'minimax_h3',
    name: 'Minimax H3',
    tag: 'Video',
    description: 'Text, image & reference-to-video — tới 15s, 2K, audio stereo native.',
  },
  {
    id: 'flux-3',
    name: 'FLUX 3',
    tag: 'Video',
    description: 'Model video thế hệ mới — text & image to video, nhiều tỉ lệ khung hình.',
  },
  {
    id: 'google_image_gen_banana_pro',
    name: 'Nano Banana Pro',
    tag: 'Ảnh',
    description: 'Tạo & sửa ảnh Google — 1K–12K, hỗ trợ typography tiếng Việt.',
  },
  {
    id: 'imagegen_2_0',
    name: 'GPT Image 2',
    tag: 'Ảnh',
    description: 'Tạo ảnh OpenAI thế hệ mới — prompt chính xác, chi tiết cao.',
  },
];
