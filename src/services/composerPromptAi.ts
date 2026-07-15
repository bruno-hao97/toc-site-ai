import type { JobType } from './api';
import { askGommo, isGommoChatConfigured } from './gommoChat';
import { parseShotsFromText, type ComposerShot } from './composerShots';

const ENHANCE_SYSTEM =
  'You are an expert prompt engineer for AI image and video generation.\n' +
  'Given a user brief (any language), output ONLY one enhanced English prompt.\n' +
  'Include subject, environment, lighting, camera/motion (for video), style, and quality cues.\n' +
  'No markdown, no quotes, no explanation — prompt text only.';

const NORMALIZE_SYSTEM =
  'You normalize prompts for AI media generation.\n' +
  'Fix grammar, remove redundant words, keep the original meaning and language.\n' +
  'Output ONLY the normalized prompt — no markdown, no quotes, no explanation.';

function stripAiReply(text: string): string {
  return text
    .trim()
    .replace(/^```[\s\S]*?\n|```$/g, '')
    .replace(/^["']|["']$/g, '')
    .trim();
}

function mediaLabel(jobType: JobType): string {
  if (jobType === 'video') return 'video';
  if (jobType === 'music') return 'music';
  if (jobType === 'tts') return 'text-to-speech';
  return 'image';
}

async function callComposerAi(
  action: 'enhance' | 'normalize' | 'shots',
  text: string,
  jobType: JobType,
  opts?: { signal?: AbortSignal },
): Promise<string> {
  if (!isGommoChatConfigured()) {
    throw new Error('Cần đăng nhập Gommo và cấu hình chat để dùng AI.');
  }

  const system =
    action === 'normalize'
      ? NORMALIZE_SYSTEM
      : action === 'shots'
        ? 'You write multi-shot storyboards. Output ONLY JSON array [{"prompt":"..."}, ...].'
        : ENHANCE_SYSTEM;
  const userMsg =
    action === 'normalize'
      ? `Normalize this ${mediaLabel(jobType)} generation prompt:\n\n${text}`
      : action === 'shots'
        ? `Create a ${mediaLabel(jobType)} storyboard from:\n\n${text}`
        : `Enhance this ${mediaLabel(jobType)} generation brief into a production-ready prompt:\n\n${text}`;
  const reply = await askGommo(userMsg, {
    history: [],
    firstTurn: true,
    sessionId: crypto.randomUUID(),
    signal: opts?.signal,
    config: {
      systemPrompt: system,
      persistHistory: false,
      timeoutMs: action === 'shots' ? 120_000 : 90_000,
    },
  });
  return stripAiReply(reply);
}

export function canUseComposerPromptAi(): boolean {
  return isGommoChatConfigured();
}

export async function enhancePromptWithAi(
  text: string,
  jobType: JobType,
  opts?: { signal?: AbortSignal },
): Promise<string> {
  const brief = text.trim();
  if (!brief) return '';
  return callComposerAi('enhance', brief, jobType, opts);
}

export async function normalizePromptWithAi(
  text: string,
  jobType: JobType,
  opts?: { signal?: AbortSignal },
): Promise<string> {
  const raw = text.trim();
  if (!raw) return '';
  return callComposerAi('normalize', raw, jobType, opts);
}

export async function generateShotsWithAi(
  text: string,
  jobType: JobType,
  maxShots = 6,
  opts?: { signal?: AbortSignal },
): Promise<ComposerShot[]> {
  const brief = text.trim();
  if (!brief) return [];
  const raw = await callComposerAi('shots', brief, jobType, opts);
  const parsed = parseShotsFromText(raw, maxShots);
  if (parsed.length >= 2) return parsed;
  throw new Error('AI không trả về đủ cảnh — thử lại hoặc nhập thủ công.');
}
