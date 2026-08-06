import { GOMMO_CHAT_CONFIG } from './gommoChatConfig';

export type QuickChatContextId =
  | 'workflow'
  | 'image'
  | 'video'
  | 'audio'
  | 'music'
  | 'general';

export interface QuickChatContext {
  id: QuickChatContextId;
  /** Nhãn ngắn trên header (dưới / cạnh model). */
  label: string;
  subtitle: string;
  placeholder: string;
  emptyHint: string;
  systemPrompt: string;
}

const GENERAL_PROMPT =
  'Bạn là trợ lý AI của AGI Center (pro.agi.vn).\n' +
  'Trả lời bằng tiếng Việt, rõ ràng, hữu ích — văn bản thuần, KHÔNG dùng markdown (** ### * `).\n' +
  'Hỗ trợ người dùng hỏi đáp về tạo ảnh, video, audio, nhạc và cách dùng nền tảng.\n' +
  'KHÔNG gọi tool, web_search hay markup <|tool_calls_*|> — trả lời trực tiếp bằng văn bản.\n' +
  'Nếu cần dữ liệu realtime (giá vàng, tỷ giá…), nói rõ bạn không tra cứu trực tiếp và gợi ý nguồn tin cậy.\n' +
  'KHÔNG giả vờ đang chỉnh workflow/canvas.\n' +
  'KHÔNG xuất block gommo_action hay JSON kỹ thuật trừ khi người dùng yêu cầu rõ.\n' +
  'KHÔNG tự giới thiệu là Moonix, Moon hay trợ lý VMedia.';

const IMAGE_PROMPT =
  'Bạn là trợ lý Studio Ảnh của AGI Center.\n' +
  'Trả lời bằng tiếng Việt.\n' +
  'Giúp viết/cải thiện prompt tạo ảnh, gợi ý style, tỉ lệ, model phù hợp.\n' +
  'KHÔNG nói về canvas workflow trừ khi người dùng hỏi.\n' +
  'KHÔNG xuất gommo_action.';

const VIDEO_PROMPT =
  'Bạn là trợ lý Studio Video của AGI Center.\n' +
  'Trả lời bằng tiếng Việt.\n' +
  'Giúp viết prompt video, kịch bản ngắn, gợi ý thời lượng / tỉ lệ / chuyển cảnh.\n' +
  'KHÔNG nói về canvas workflow trừ khi người dùng hỏi.\n' +
  'KHÔNG xuất gommo_action.';

const AUDIO_PROMPT =
  'Bạn là trợ lý Studio Audio của AGI Center.\n' +
  'Trả lời bằng tiếng Việt.\n' +
  'Giúp soạn nội dung TTS, chọn giọng, chỉnh tốc độ/tone, và hướng dẫn tạo audio.\n' +
  'KHÔNG nói về canvas workflow trừ khi người dùng hỏi.\n' +
  'KHÔNG xuất gommo_action.';

const MUSIC_PROMPT =
  'Bạn là trợ lý Studio Nhạc của AGI Center.\n' +
  'Trả lời bằng tiếng Việt.\n' +
  'Giúp mô tả ý tưởng nhạc, mood, genre, lời ngắn và gợi ý thông số gen nhạc.\n' +
  'KHÔNG nói về canvas workflow trừ khi người dùng hỏi.\n' +
  'KHÔNG xuất gommo_action.';

const CONTEXTS: Record<QuickChatContextId, QuickChatContext> = {
  workflow: {
    id: 'workflow',
    label: 'Workflow',
    subtitle: 'AGI Agent · canvas WFL',
    placeholder: 'Mô tả workflow bạn muốn tạo…',
    emptyHint: 'Mô tả workflow ảnh/video — mình sẽ hỗ trợ trên canvas.',
    systemPrompt: GOMMO_CHAT_CONFIG.systemPrompt ?? GENERAL_PROMPT,
  },
  image: {
    id: 'image',
    label: 'Image',
    subtitle: 'Studio Ảnh',
    placeholder: 'Mô tả ảnh bạn muốn tạo…',
    emptyHint: 'Hỏi về prompt ảnh, style, tỉ lệ hoặc model.',
    systemPrompt: IMAGE_PROMPT,
  },
  video: {
    id: 'video',
    label: 'Video',
    subtitle: 'Studio Video',
    placeholder: 'Mô tả video hoặc kịch bản…',
    emptyHint: 'Hỏi về prompt video, scene hoặc thông số gen.',
    systemPrompt: VIDEO_PROMPT,
  },
  audio: {
    id: 'audio',
    label: 'Audio',
    subtitle: 'Studio Audio',
    placeholder: 'Nội dung cần đọc / giọng nói…',
    emptyHint: 'Hỏi về TTS, giọng đọc hoặc chỉnh audio.',
    systemPrompt: AUDIO_PROMPT,
  },
  music: {
    id: 'music',
    label: 'Music',
    subtitle: 'Studio Nhạc',
    placeholder: 'Mô tả bản nhạc bạn muốn…',
    emptyHint: 'Hỏi về mood, genre hoặc gen nhạc.',
    systemPrompt: MUSIC_PROMPT,
  },
  general: {
    id: 'general',
    label: 'Chat',
    subtitle: 'Trợ lý tổng quát',
    placeholder: 'Bạn muốn hỏi điều gì…',
    emptyHint: 'Bạn muốn hỏi điều gì hôm nay?',
    systemPrompt: GENERAL_PROMPT,
  },
};

/** Map pathname → ngữ cảnh chat. */
export function resolveQuickChatContext(pathname: string): QuickChatContext {
  if (pathname === '/workflow') return CONTEXTS.workflow;
  if (pathname === '/image') return CONTEXTS.image;
  if (pathname === '/video') return CONTEXTS.video;
  if (pathname === '/audio') return CONTEXTS.audio;
  if (pathname === '/music') return CONTEXTS.music;
  return CONTEXTS.general;
}
