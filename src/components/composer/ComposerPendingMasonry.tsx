import { useMemo, type CSSProperties } from 'react';
import { useLocale } from '../../i18n';
import { FeedItemPendingCard } from '../FeedItemPendingCard';
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
}: {
  jobs: ComposerPendingJob[];
  className?: string;
  wrapClassName?: string;
  style?: CSSProperties;
  thumbSize?: number;
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

  return (
    <section className={wrapClassName}>
      <header className="clib-group-head">
        <span className="clib-group-label">{t('composer.processing')}</span>
        <span className="clib-count">({active.length})</span>
      </header>
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
