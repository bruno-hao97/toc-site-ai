import { useMemo, type CSSProperties } from 'react';
import { useLocale } from '../../i18n';
import { FeedItemPendingCard, MasonryPendingMedia } from '../FeedItemPendingCard';
import type { ComposerPendingJob } from '../ComposerHistory';

const DEFAULT_PENDING_THUMB = 200;

export function activePendingJobs(jobs: ComposerPendingJob[]): ComposerPendingJob[] {
  return jobs.filter((p) => p.status === 'processing');
}

export default function ComposerPendingMasonry({
  jobs,
  className = 'clib-grid',
  wrapClassName = 'clib-group',
  style,
  thumbSize = DEFAULT_PENDING_THUMB,
  variant = 'library',
  showHeader = true,
}: {
  jobs: ComposerPendingJob[];
  className?: string;
  wrapClassName?: string;
  style?: CSSProperties;
  thumbSize?: number;
  /** `library` = masonry card giống /home/library; `clib` = clib-grid legacy */
  variant?: 'library' | 'clib';
  showHeader?: boolean;
}) {
  const { t } = useLocale();
  const active = activePendingJobs(jobs);
  const gridStyle = useMemo((): CSSProperties => {
    const thumb = `${thumbSize}px`;
    return {
      ['--clib-thumb' as string]: thumb,
      ['--thumb' as string]: thumb,
      ...style,
    };
  }, [style, thumbSize]);

  if (active.length === 0) return null;

  if (variant === 'library') {
    const grid = (
      <div className={`home-masonry home-masonry--library${className ? ` ${className}` : ''}`}>
        {active.map((p) => (
          <article
            key={p.id}
            className={`feed-masonry-card feed-masonry-card--pending ${p.status}`}
          >
            <MasonryPendingMedia prompt={p.prompt} status={p.status} progress={p.progress} />
          </article>
        ))}
      </div>
    );

    if (!showHeader) return grid;

    return (
      <section className={wrapClassName || 'clib-group'}>
        <header className="clib-group-head">
          <span className="clib-group-label">{t('composer.processing')}</span>
          <span className="clib-count">({active.length})</span>
        </header>
        {grid}
      </section>
    );
  }

  return (
    <section className={wrapClassName}>
      {showHeader && (
        <header className="clib-group-head">
          <span className="clib-group-label">{t('composer.processing')}</span>
          <span className="clib-count">({active.length})</span>
        </header>
      )}
      <div className={className} style={gridStyle}>
        {active.map((p) => (
          <FeedItemPendingCard
            key={p.id}
            prompt={p.prompt}
            status={p.status}
            progress={p.progress}
          />
        ))}
      </div>
    </section>
  );
}
