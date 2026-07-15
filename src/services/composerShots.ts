import type { GommoModel } from './api';

export interface ComposerShot {
  id: string;
  prompt: string;
  duration?: string;
}

export interface MultiShotConfig {
  minShots: number;
  maxShots: number;
  minShotSec: number;
}

function cfgBlock(model: GommoModel | null, ...keys: string[]): Record<string, unknown> {
  const root = (model?.configs || {}) as Record<string, unknown>;
  for (const key of keys) {
    const block = root[key];
    if (block && typeof block === 'object') return block as Record<string, unknown>;
  }
  return {};
}

export function getMultiShotConfig(model: GommoModel | null): MultiShotConfig {
  const block = cfgBlock(model, 'multi_shots', 'multiShots', 'multi_shot');
  const limits = block.limits as { min?: number; max?: number; min_duration?: number } | undefined;
  return {
    minShots: Math.max(1, Number(limits?.min ?? block.min_shots ?? block.minShots) || 2),
    maxShots: Math.min(6, Number(limits?.max ?? block.max_shots ?? block.maxShots) || 6),
    minShotSec: Math.max(1, Number(limits?.min_duration ?? block.min_duration) || 3),
  };
}

export function newShot(prompt = ''): ComposerShot {
  return { id: crypto.randomUUID(), prompt, duration: undefined };
}

/** Chia đều duration tổng cho từng shot (làm tròn lên). */
export function splitDurationEvenly(totalSec: string | undefined, count: number, minSec: number): string[] {
  const total = Math.max(minSec * count, Number(totalSec) || minSec * count);
  const base = Math.floor(total / count);
  const rem = total - base * count;
  return Array.from({ length: count }, (_, i) => String(Math.max(minSec, base + (i < rem ? 1 : 0))));
}

/** Build extra payload cho model hỗ trợ multi-shot (Kling Omni, VEO…). */
export function buildMultiShotPayload(
  shots: ComposerShot[],
  totalDuration?: string,
  cfg?: MultiShotConfig,
): Record<string, unknown> {
  const valid = shots.filter((s) => s.prompt.trim());
  const minSec = cfg?.minShotSec ?? 3;
  const durations =
    valid.some((s) => s.duration) && valid.every((s) => s.duration)
      ? valid.map((s) => s.duration!)
      : splitDurationEvenly(totalDuration, valid.length, minSec);

  return {
    multi_shot: true,
    shot_type: 'customize',
    multi_prompt: valid.map((s, i) => ({
      index: i + 1,
      prompt: s.prompt.trim(),
      duration: durations[i] ?? String(minSec),
    })),
  };
}

/** Parse danh sách cảnh từ text (AI hoặc dán thủ công). */
export function parseShotsFromText(text: string, maxShots = 6): ComposerShot[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // JSON array
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed) as unknown[];
      if (Array.isArray(arr)) {
        return arr
          .slice(0, maxShots)
          .map((item) => {
            if (typeof item === 'string') return newShot(item);
            const o = item as { prompt?: string; duration?: string | number };
            const shot = newShot(String(o.prompt ?? ''));
            if (o.duration != null) shot.duration = String(o.duration);
            return shot;
          })
          .filter((s) => s.prompt.trim());
      }
    } catch {
      /* fallback below */
    }
  }

  // Numbered lines: "1. ..." or "Cảnh 1: ..."
  const lines = trimmed.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const numbered = lines
    .map((line) => {
      const m = line.match(/^(?:\d+[\.)]|cảnh\s*\d+[:\.]?)\s*(.+)$/i);
      return (m ? m[1] : line).trim();
    })
    .filter(Boolean);

  if (numbered.length >= 2) {
    return numbered.slice(0, maxShots).map((p) => newShot(p));
  }

  // Separator blocks
  const blocks = trimmed
    .split(/=====+|---+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (blocks.length >= 2) {
    return blocks.slice(0, maxShots).map((p) => newShot(p));
  }

  return [newShot(trimmed)];
}
