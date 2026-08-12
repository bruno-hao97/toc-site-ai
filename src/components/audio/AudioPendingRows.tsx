import { Loader2 } from 'lucide-react';
import { useLocale } from '../../i18n';

export interface AudioPendingJob {
  id: string;
  text: string;
  status: 'processing' | 'failed';
  progress?: number;
}

export function activeAudioPending(jobs: AudioPendingJob[]): AudioPendingJob[] {
  return jobs.filter((p) => p.status === 'processing');
}

export function AudioPendingListRows({ jobs }: { jobs: AudioPendingJob[] }) {
  const { t } = useLocale();
  const active = activeAudioPending(jobs);
  if (active.length === 0) return null;

  return (
    <>
      {active.map((p, idx) => (
        <article key={p.id} className="audio-session-row audio-session-row--pending">
          <span className="audio-session-index">{idx + 1}</span>
          <span className="audio-session-play" aria-hidden>
            <Loader2 size={14} className="spin" />
          </span>
          <div className="audio-session-row-body">
            <p>{p.text}</p>
            <small>{t('audio.generating')}</small>
            <div
              className="chist-pending-bar"
              role="progressbar"
              aria-valuenow={p.progress ?? 12}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="chist-pending-bar-fill"
                style={{ width: `${p.progress ?? 12}%` }}
              />
            </div>
          </div>
        </article>
      ))}
    </>
  );
}

export function AudioPendingGridCards({ jobs }: { jobs: AudioPendingJob[] }) {
  const { t } = useLocale();
  const active = activeAudioPending(jobs);
  if (active.length === 0) return null;

  return (
    <>
      {active.map((p) => (
        <article key={p.id} className="audio-session-card audio-session-card--pending">
          <div className="audio-session-card-body">
            <span className="audio-session-icon">
              <Loader2 size={18} className="spin" />
            </span>
            <div className="audio-session-card-text">
              <strong>{p.text}</strong>
              <small>{t('audio.generating')}</small>
            </div>
          </div>
          <div className="audio-session-card-foot">
            <div
              className="chist-pending-bar"
              role="progressbar"
              aria-valuenow={p.progress ?? 12}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="chist-pending-bar-fill"
                style={{ width: `${p.progress ?? 12}%` }}
              />
            </div>
          </div>
        </article>
      ))}
    </>
  );
}
