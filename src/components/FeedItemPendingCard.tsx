import { useLocale } from '../i18n';

export type PendingCardStatus = 'processing' | 'failed';

const DEFAULT_PROGRESS = 12;

export function PendingVmediaContent({
  status,
  progress = DEFAULT_PROGRESS,
}: {
  status: PendingCardStatus;
  progress?: number;
}) {
  const { t } = useLocale();

  if (status === 'processing') {
    return (
      <>
        <span className="pending-spinner-lg" aria-hidden />
        <span className="pending-vmedia-label">{t('composer.processingLabel')}</span>
        <div
          className="pending-vmedia-bar"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('composer.progressAria')}
        >
          <div className="pending-vmedia-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      </>
    );
  }

  return (
    <>
      <span className="pending-failed-icon-lg">!</span>
      <span className="pending-vmedia-label failed">{t('composer.failedLabel')}</span>
    </>
  );
}

export function FeedItemPendingCard({
  prompt,
  status = 'processing',
  progress = DEFAULT_PROGRESS,
  className = '',
}: {
  prompt?: string;
  status?: PendingCardStatus;
  progress?: number;
  className?: string;
}) {
  const text = prompt?.trim();
  return (
    <article
      className={`hist-card hist-card-pending-vmedia ${status}${className ? ` ${className}` : ''}`}
    >
      <div className="pending-vmedia-body">
        <PendingVmediaContent status={status} progress={progress} />
      </div>
      {text ? (
        <p className="pending-vmedia-prompt" title={text}>
          {text}
        </p>
      ) : null}
    </article>
  );
}

/** Pending UI inside masonry column cards (no nested article). */
export function MasonryPendingMedia({
  prompt,
  status = 'processing',
  progress = DEFAULT_PROGRESS,
}: {
  prompt?: string;
  status?: PendingCardStatus;
  progress?: number;
}) {
  const text = prompt?.trim();
  return (
    <div className="feed-masonry-pending-wrap">
      <div className="pending-vmedia-body">
        <PendingVmediaContent status={status} progress={progress} />
      </div>
      {text ? (
        <p className="pending-vmedia-prompt" title={text}>
          {text}
        </p>
      ) : null}
    </div>
  );
}
