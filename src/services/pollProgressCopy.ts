import { normalizeStatus, type StatusPhase } from './mediaGenerationStatus';
import type { PollProgress } from './polling';

export type ProgressLocale = 'vi' | 'en';

const STORAGE_KEY = 'appLanguage';

export function readProgressLocale(): ProgressLocale {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'en' || raw === 'vi') return raw;
  } catch {
    /* ignore */
  }
  return 'vi';
}

const CREATING: Record<ProgressLocale, string> = {
  vi: 'Đang gửi yêu cầu…',
  en: 'Sending request…',
};

const STARTING: Record<ProgressLocale, string> = {
  vi: 'Đang tạo…',
  en: 'Creating…',
};

const STATUS_LABELS: Record<ProgressLocale, Record<string, string>> = {
  vi: {
    PENDING: 'Đang xếp hàng…',
    QUEUED: 'Đang xếp hàng…',
    PENDING_ACTIVE: 'Đang chờ AI xử lý…',
    PENDING_PROCESSING: 'Đang chuẩn bị…',
    PROCESSING: 'AI đang tạo…',
    ACTIVE: 'Đang xử lý…',
    MEDIA_GENERATION_STATUS_PENDING: 'Đang tạo video…',
    MEDIA_GENERATION_STATUS_ACTIVE: 'Đang render video…',
    MEDIA_GENERATION_STATUS_PROCESSING: 'Đang xử lý video…',
  },
  en: {
    PENDING: 'Queued…',
    QUEUED: 'Queued…',
    PENDING_ACTIVE: 'Waiting for AI…',
    PENDING_PROCESSING: 'Preparing…',
    PROCESSING: 'AI is generating…',
    ACTIVE: 'Processing…',
    MEDIA_GENERATION_STATUS_PENDING: 'Creating video…',
    MEDIA_GENERATION_STATUS_ACTIVE: 'Rendering video…',
    MEDIA_GENERATION_STATUS_PROCESSING: 'Processing video…',
  },
};

const PHASE_FALLBACK: Record<ProgressLocale, Record<StatusPhase, string>> = {
  vi: {
    success: 'Hoàn tất!',
    running: 'Đang xử lý…',
    failed: 'Tạo thất bại — vui lòng thử lại',
    unknown: 'Đang tạo…',
  },
  en: {
    success: 'Done!',
    running: 'Processing…',
    failed: 'Generation failed — please try again',
    unknown: 'Creating…',
  },
};

export function formatCreatingProgressMessage(locale = readProgressLocale()): string {
  return CREATING[locale];
}

export function formatStartingProgressMessage(locale = readProgressLocale()): string {
  return STARTING[locale];
}

export function formatPollProgressMessage(
  prog: PollProgress,
  locale = readProgressLocale(),
): string {
  if (prog.phase === 'success') return PHASE_FALLBACK[locale].success;
  if (prog.phase === 'failed') return PHASE_FALLBACK[locale].failed;

  const label = STATUS_LABELS[locale][normalizeStatus(prog.status)];
  if (label) return label;

  return PHASE_FALLBACK[locale][prog.phase] ?? PHASE_FALLBACK[locale].unknown;
}

export function formatPollTimeoutMessage(locale = readProgressLocale()): string {
  return locale === 'en' ? 'Timed out — please try again' : 'Quá thời gian chờ — thử lại sau';
}

export function formatPollCancelledMessage(locale = readProgressLocale()): string {
  return locale === 'en' ? 'Cancelled' : 'Đã hủy';
}

export function formatPollDoneMessage(locale = readProgressLocale()): string {
  return locale === 'en' ? 'Done!' : 'Hoàn tất!';
}

/** Dev playground — giữ chi tiết kỹ thuật ngắn gọn, không show "Poll #N". */
export function formatPollProgressDevMessage(
  prog: PollProgress,
  locale = readProgressLocale(),
): string {
  const friendly = formatPollProgressMessage(prog, locale);
  const raw = normalizeStatus(prog.status);
  if (!raw || friendly === PHASE_FALLBACK[locale][prog.phase]) {
    return friendly;
  }
  return `${friendly} (${raw})`;
}
