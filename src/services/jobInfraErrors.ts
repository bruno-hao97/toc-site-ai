/** Phân biệt lỗi kỹ thuật (proxy/DB/HTML) vs job VMedia thật sự fail. */

const INFRA_RE =
  /job không tồn tại|không poll|auth_bridge|html thay vì json|html error|upstream http|dịch vụ .* chưa sẵn sàng|máy chủ trả html|econnrefused|etimedout|502|503|504|waf|forbidden|không kết nối|bridge/i;

const PROVIDER_FAIL_RE =
  /failed|failure|rejected|cancelled|canceled|nsfw|blocked|denied|policy|vi phạm|thất bại|error/i;

export function isInfraJobError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  if (!msg.trim()) return false;
  if (INFRA_RE.test(msg)) return true;
  // HTTP 404 đơn độc thường là endpoint/proxy, không phải status fail của VMedia.
  if (/\bHTTP\s*404\b/i.test(msg) && !PROVIDER_FAIL_RE.test(msg)) return true;
  return false;
}

/** Thông báo khi job đã vào VMedia nhưng site chưa poll được kết quả. */
export function formatAcceptedPendingMessage(providerJobId?: string): string {
  const id = providerJobId?.trim();
  return id
    ? `Đã gửi lên VMedia (job ${id.slice(0, 12)}…). Đang xử lý — không bấm tạo lại.`
    : 'Đã gửi lên VMedia và đang xử lý — không bấm tạo lại. Kiểm tra thư viện / vmedia.ai.';
}

/** Job đã được VMedia nhận; UI không được coi là tạo thất bại / khuyến khích bấm lại. */
export class JobAcceptedPendingError extends Error {
  readonly providerJobId?: string;
  readonly acceptedPending = true as const;

  constructor(providerJobId?: string, message?: string) {
    super(message || formatAcceptedPendingMessage(providerJobId));
    this.name = 'JobAcceptedPendingError';
    this.providerJobId = providerJobId;
  }
}

export function isJobAcceptedPendingError(err: unknown): err is JobAcceptedPendingError {
  return (
    err instanceof JobAcceptedPendingError ||
    (err instanceof Error &&
      ((err as { acceptedPending?: boolean }).acceptedPending === true ||
        /đã gửi lên vmedia/i.test(err.message)))
  );
}

type PollLike = {
  success?: boolean;
  acceptedPending?: boolean;
  infraError?: boolean;
  timeout?: boolean;
  error?: string;
};

/**
 * Trả URL kết quả, hoặc ném JobAcceptedPendingError nếu VMedia đã nhận job,
 * hoặc ném Error thường nếu thật sự fail.
 */
export function requireJobResultUrl(opts: {
  resultUrl?: string | null;
  acceptedOnProvider?: boolean;
  providerJobId?: string;
  pollResult?: PollLike | null;
  failMessage?: string;
}): string {
  const url = opts.resultUrl?.trim();
  if (url) return url;

  const poll = opts.pollResult;
  const soft =
    opts.acceptedOnProvider &&
    Boolean(poll?.acceptedPending || poll?.infraError || poll?.timeout);

  if (soft) {
    throw new JobAcceptedPendingError(opts.providerJobId, poll?.error);
  }

  throw new Error(poll?.error || opts.failMessage || 'Job thất bại');
}
