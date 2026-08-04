export const SESSION_EXPIRED_EVENT = 'auth:session-expired';

export const DEFAULT_SESSION_EXPIRED_MESSAGE =
  'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.';

export interface SessionExpiredDetail {
  message: string;
}

export function dispatchSessionExpired(
  message = DEFAULT_SESSION_EXPIRED_MESSAGE,
): void {
  if (typeof document === 'undefined') return;
  document.dispatchEvent(
    new CustomEvent<SessionExpiredDetail>(SESSION_EXPIRED_EVENT, {
      detail: { message },
    }),
  );
}

export function onSessionExpired(
  handler: (message: string) => void,
): () => void {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<SessionExpiredDetail>).detail;
    handler(detail?.message || DEFAULT_SESSION_EXPIRED_MESSAGE);
  };
  document.addEventListener(SESSION_EXPIRED_EVENT, listener);
  return () => document.removeEventListener(SESSION_EXPIRED_EVENT, listener);
}
