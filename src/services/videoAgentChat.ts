import { parseShotsFromText, type ComposerShot } from './composerShots';
import { canUseComposerPromptAi } from './composerPromptAi';
import { askGommo, isGommoChatConfigured, type ChatTurn } from './gommoChat';

export const VIDEO_AGENT_WELCOME =
  'Tôi là **Video Agent** (Gemini). Hãy mô tả ý tưởng video — tôi sẽ phân tích và soạn **kịch bản / prompt** (1 cảnh hoặc nhiều cảnh).\n\n' +
  'Ví dụ: "30s quảng cáo nước hoa, 3 cảnh, cinematic, golden hour."';

const VIDEO_AGENT_SYSTEM =
  'You are Video Agent — a professional AI video scriptwriter for short-form AI video generation.\n' +
  'Reply in Vietnamese when the user writes in Vietnamese; otherwise match their language.\n' +
  'Be concise and helpful in chat. When the user wants a script or is ready to generate:\n' +
  '- For ONE scene: give a detailed English video prompt in a fenced block ```prompt ... ``` OR plain paragraph.\n' +
  '- For MULTIPLE scenes: output ONLY a JSON array [{"prompt":"scene description in English"}, ...] with 2–6 items.\n' +
  'Include camera, motion, lighting, and style cues in each prompt.\n' +
  'Do not invent URLs or claim you rendered video — you only write scripts.';

export interface VideoAgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export function canUseVideoAgentChat(): boolean {
  return canUseComposerPromptAi();
}

export function parseVideoAgentScript(
  text: string,
  maxShots = 6,
): { prompt?: string; shots?: ComposerShot[] } {
  const fenced = text.match(/```(?:prompt)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]?.trim()) {
    return { prompt: fenced[1].trim() };
  }

  const shots = parseShotsFromText(text, maxShots);
  if (shots.length >= 2) return { shots };
  if (shots.length === 1 && shots[0].prompt.trim()) {
    return { prompt: shots[0].prompt.trim() };
  }

  const trimmed = text.replace(/\*\*/g, '').trim();
  if (trimmed.length > 40 && !trimmed.startsWith('⚠️')) {
    return { prompt: trimmed };
  }
  return {};
}

export async function askVideoAgent(
  message: string,
  history: ChatTurn[],
  opts: {
    sessionId: string;
    firstTurn?: boolean;
    onDelta?: (chunk: string) => void;
    signal?: AbortSignal;
  },
): Promise<string> {
  const text = message.trim();
  if (!text) return '';

  if (!isGommoChatConfigured()) {
    throw new Error('Cần đăng nhập Gommo để dùng Video Agent.');
  }

  return askGommo(text, {
    history,
    firstTurn: opts.firstTurn ?? history.length === 0,
    sessionId: opts.sessionId,
    signal: opts.signal,
    onDelta: opts.onDelta,
    config: {
      systemPrompt: VIDEO_AGENT_SYSTEM,
      persistHistory: false,
      timeoutMs: 120_000,
    },
  });
}
