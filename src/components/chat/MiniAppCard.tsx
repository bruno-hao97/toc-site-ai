import { Star } from 'lucide-react';
import {
  formatMiniAppPrice,
  isMiniAppFree,
  miniAppRating,
  miniAppThumb,
  type MiniAppItem,
} from '../../services/miniAppsApi';

interface Props {
  app: MiniAppItem;
  compact?: boolean;
  showcase?: boolean;
  onView: (app: MiniAppItem) => void;
}

export default function MiniAppCard({ app, compact = false, showcase = false, onView }: Props) {
  const thumb = miniAppThumb(app);
  const banner = (app.banner_url || app.avatar_url || '').trim();
  const rating = miniAppRating(app);
  const author = app.authorInfo?.name || app.authorInfo?.username || 'Ẩn danh';
  const free = isMiniAppFree(app);

  if (showcase) {
    return (
      <article
        className="mini-app-card mini-app-card--showcase mini-app-card--clickable"
        role="button"
        tabIndex={0}
        onClick={() => onView(app)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onView(app);
          }
        }}
      >
        <div className="mini-app-card-showcase-media">
          {banner ? (
            <img src={banner} alt="" loading="lazy" />
          ) : (
            <span className="mini-app-card-media-fallback">{app.name.slice(0, 1)}</span>
          )}
          <div className="mini-app-card-showcase-overlay">
            <h3 className="mini-app-card-showcase-title" title={app.name}>
              {app.name}
            </h3>
            {app.description && (
              <p className="mini-app-card-showcase-desc">{app.description}</p>
            )}
            <div className="mini-app-card-showcase-meta">
              <span className="mini-app-card-author">{author}</span>
              {rating > 0 && (
                <span className="mini-app-card-rating">
                  <Star size={12} fill="currentColor" />
                  {rating.toFixed(1)}
                </span>
              )}
            </div>
          </div>
          <span className="mini-app-card-showcase-price">
            {free ? 'Miễn phí' : formatMiniAppPrice(app)}
          </span>
        </div>
        <button
          type="button"
          className="mini-app-card-view"
          onClick={(e) => {
            e.stopPropagation();
            onView(app);
          }}
        >
          Xem
        </button>
      </article>
    );
  }

  if (compact) {
    return (
      <article
        className="mini-app-card mini-app-card--strip mini-app-card--clickable"
        role="button"
        tabIndex={0}
        onClick={() => onView(app)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onView(app);
          }
        }}
      >
        <div className="mini-app-card-media">
          {thumb ? (
            <img src={thumb} alt="" loading="lazy" />
          ) : (
            <span className="mini-app-card-media-fallback">{app.name.slice(0, 1)}</span>
          )}
        </div>
        <h3 className="mini-app-card-title" title={app.name}>
          {app.name}
        </h3>
        <span className="mini-app-card-author">{author}</span>
        <div className="mini-app-card-strip-footer">
          {rating > 0 ? (
            <span className="mini-app-card-rating">
              <Star size={11} fill="currentColor" />
              {rating.toFixed(1)}
            </span>
          ) : (
            <span />
          )}
          {free && <span className="mini-app-card-free">Free</span>}
        </div>
        <button
          type="button"
          className="mini-app-card-view"
          onClick={(e) => {
            e.stopPropagation();
            onView(app);
          }}
        >
          Xem
        </button>
      </article>
    );
  }

  return (
    <article
      className="mini-app-card mini-app-card--clickable"
      role="button"
      tabIndex={0}
      onClick={() => onView(app)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onView(app);
        }
      }}
    >
      <div className="mini-app-card-media">
        {thumb ? (
          <img src={thumb} alt="" loading="lazy" />
        ) : (
          <span className="mini-app-card-media-fallback">{app.name.slice(0, 1)}</span>
        )}
      </div>
      <div className="mini-app-card-body">
        <h3 className="mini-app-card-title" title={app.name}>
          {app.name}
        </h3>
        {app.description && <p className="mini-app-card-desc">{app.description}</p>}
        <div className="mini-app-card-meta">
          <span className="mini-app-card-author">{author}</span>
          {rating > 0 && (
            <span className="mini-app-card-rating">
              <Star size={12} fill="currentColor" />
              {rating.toFixed(1)}
            </span>
          )}
        </div>
        {!free && <span className="mini-app-card-price">{formatMiniAppPrice(app)}</span>}
      </div>
      <button
        type="button"
        className="mini-app-card-view"
        onClick={(e) => {
          e.stopPropagation();
          onView(app);
        }}
      >
        Xem
      </button>
    </article>
  );
}
