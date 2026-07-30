import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Globe,
  Hash,
  Share2,
  Star,
  Tag,
  X,
  Zap,
} from 'lucide-react';
import {
  fetchMiniAppInfo,
  fetchMiniAppVotes,
  formatMiniAppPrice,
  isMiniAppFree,
  miniAppLongDescription,
  miniAppRating,
  miniAppRatingCount,
  miniAppReviewAuthor,
  miniAppReviewAvatar,
  miniAppReviewComment,
  miniAppScore,
  miniAppThumb,
  miniAppUsageCount,
  openMiniAppInApp,
  type MiniAppDetail,
  type MiniAppItem,
  type MiniAppReview,
  type MiniAppVotesResult,
} from '../../services/miniAppsApi';

type DetailTab = 'overview' | 'content' | 'reviews';

interface Props {
  app: MiniAppItem;
  variant?: 'inline' | 'overlay';
  onBack: () => void;
}

function StarRating({ value, size = 14 }: { value: number; size?: number }) {
  const filled = Math.round(value);
  return (
    <span className="mini-app-detail-stars" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          fill={i <= filled ? 'currentColor' : 'none'}
          strokeWidth={i <= filled ? 0 : 1.75}
        />
      ))}
    </span>
  );
}

function ReviewCard({ review }: { review: MiniAppReview }) {
  const author = miniAppReviewAuthor(review);
  const avatar = miniAppReviewAvatar(review);
  const rating = review.rating ?? 0;
  const comment = miniAppReviewComment(review);

  return (
    <article className="mini-app-detail-review-card">
      <div className="mini-app-detail-review-card-head">
        <div className="mini-app-detail-review-user">
          {avatar ? (
            <div className="mini-app-detail-review-avatar">
              <img src={avatar} alt="" />
            </div>
          ) : null}
          <strong>{author}</strong>
        </div>
        <StarRating value={rating} size={12} />
      </div>
      {comment ? <p>{comment}</p> : null}
    </article>
  );
}

function ReviewsSection({
  rating,
  ratingCount,
  reviews,
  title = 'Xếp hạng & nhận xét',
}: {
  rating: number;
  ratingCount: number;
  reviews: MiniAppReview[];
  title?: string;
}) {
  const countLabel =
    ratingCount > 0
      ? `${ratingCount} lượt đánh giá`
      : '0 lượt đánh giá';

  return (
    <section className="mini-app-detail-section mini-app-detail-section--divider">
      <div className="mini-app-detail-reviews-head">
        <h3>{title}</h3>
        <span>{countLabel}</span>
      </div>
      <div className="mini-app-detail-reviews">
        <div className="mini-app-detail-reviews-left">
          <div className="mini-app-detail-reviews-score">
            {rating > 0 ? rating.toFixed(1) : '—'}
            <span>/5</span>
          </div>
          <StarRating value={rating} size={16} />
        </div>
        <div className="mini-app-detail-reviews-right">
          {reviews.length > 0 ? (
            reviews.map((review, i) => (
              <ReviewCard key={review.id ?? `${miniAppReviewComment(review)}-${i}`} review={review} />
            ))
          ) : (
            <p className="mini-app-detail-empty">Chưa có nhận xét nào.</p>
          )}
        </div>
      </div>
    </section>
  );
}

export default function MiniAppDetailView({ app, variant = 'inline', onBack }: Props) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<MiniAppDetail | null>(null);
  const [votes, setVotes] = useState<MiniAppVotesResult | null>(null);
  const [tab, setTab] = useState<DetailTab>('overview');
  const [loading, setLoading] = useState(false);
  const [votesLoading, setVotesLoading] = useState(false);
  const [error, setError] = useState('');
  const [votesError, setVotesError] = useState('');

  useEffect(() => {
    setTab('overview');
    setDetail(null);
    setVotes(null);
    setError('');
    setVotesError('');
    setLoading(true);
    setVotesLoading(true);

    void fetchMiniAppInfo(app)
      .then(setDetail)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));

    void fetchMiniAppVotes(app)
      .then(setVotes)
      .catch((err) => {
        setVotesError(err instanceof Error ? err.message : String(err));
        setVotes(null);
      })
      .finally(() => setVotesLoading(false));
  }, [app]);

  const data = detail ?? app;
  const banner = (data.banner_url || data.avatar_url || '').trim();
  const avatar = miniAppThumb(data);
  const rating = votes?.summary.rating_avg ?? miniAppRating(data);
  const ratingCount = votes?.summary.rating_count ?? miniAppRatingCount(data);
  const reviews = votes?.items ?? [];
  const usage = miniAppUsageCount(data);
  const rank = miniAppScore(data);
  const author = data.authorInfo?.name || data.authorInfo?.username || 'Ẩn danh';
  const category = data.tags?.[0] || 'Code Chat';
  const tagExtra = data.tags?.[1] || '';
  const gallery = (data.gallery ?? []).filter(Boolean);
  const previews = gallery.length > 0 ? gallery : banner ? [banner] : [];
  const previewLandscape = gallery.length === 0;
  const shortDesc = (data.description || '').trim();
  const longDesc = miniAppLongDescription(data);
  const showLongDesc = Boolean(longDesc && longDesc !== shortDesc);
  const free = isMiniAppFree(data);
  const privacy = data.privacy || 'PUBLIC';

  const stats = [
    { icon: Star, value: rating > 0 ? rating.toFixed(1) : '—' },
    { icon: Download, value: `${usage} lượt tải` },
    { icon: Hash, value: rank > 0 ? String(Math.round(rank)) : '—' },
    { icon: Globe, value: privacy },
    { icon: Tag, value: category },
    ...(tagExtra ? [{ icon: Tag, value: tagExtra }] : [{ icon: Tag, value: author }]),
  ].slice(0, 6);

  const handleUse = () => {
    onBack();
    openMiniAppInApp(data, navigate);
  };

  return (
    <div className={`mini-app-detail mini-app-detail--${variant}`}>
      <div className="mini-app-detail-scroll">
        <div
          className="mini-app-detail-hero"
          style={banner ? { backgroundImage: `url(${banner})` } : undefined}
        >
          <div className="mini-app-detail-hero-shade" aria-hidden="true" />
          {variant === 'inline' ? (
            <button type="button" className="mini-app-detail-back" onClick={onBack}>
              <ArrowLeft size={16} />
              Markets
            </button>
          ) : (
            <button type="button" className="mini-app-detail-close" onClick={onBack} aria-label="Đóng">
              <X size={18} />
            </button>
          )}
          <div className="mini-app-detail-hero-identity">
            <div className="mini-app-detail-avatar">
              {avatar ? (
                <img src={avatar} alt="" />
              ) : (
                <span>{data.name.slice(0, 1)}</span>
              )}
            </div>
            <div className="mini-app-detail-hero-copy">
              <h2>{data.name}</h2>
              {shortDesc && <p>{shortDesc}</p>}
            </div>
          </div>
        </div>

        <div className="mini-app-detail-head">
          <div className="mini-app-detail-actions">
            <button type="button" className="mini-app-detail-action" aria-label="Chia sẻ">
              <Share2 size={15} />
            </button>
          </div>

          <div className="mini-app-detail-tabs" role="tablist">
            {(
              [
                ['overview', 'Tổng quan'],
                ['content', 'Nội dung'],
                ['reviews', 'Đánh giá'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={`mini-app-detail-tab${tab === id ? ' mini-app-detail-tab--active' : ''}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mini-app-detail-stats">
            {stats.map(({ icon: Icon, value }, i) => (
              <div key={`${value}-${i}`} className="mini-app-detail-stat">
                <Icon size={13} aria-hidden="true" />
                <span>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {loading && <p className="mini-app-detail-status">Đang tải thông tin…</p>}
        {error && <p className="mini-app-detail-status mini-app-detail-status--error">{error}</p>}
        {votesLoading && !votes && !votesError && (
          <p className="mini-app-detail-status">Đang tải đánh giá…</p>
        )}
        {votesError && (
          <p className="mini-app-detail-status mini-app-detail-status--error">{votesError}</p>
        )}

        {tab === 'overview' && (
          <div className="mini-app-detail-body">
            {previews.length > 0 && (
              <section className="mini-app-detail-section">
                <h3>Ảnh xem trước</h3>
                <div className="mini-app-detail-previews">
                  {previews.map((url) => (
                    <div
                      key={url}
                      className={`mini-app-detail-preview${previewLandscape ? ' mini-app-detail-preview--landscape' : ''}`}
                    >
                      <img src={url} alt="" loading="lazy" />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {showLongDesc && (
              <section className="mini-app-detail-section">
                <h3>Mô tả</h3>
                <p className="mini-app-detail-desc">{longDesc}</p>
              </section>
            )}

            {!showLongDesc && shortDesc && (
              <section className="mini-app-detail-section">
                <h3>Mô tả</h3>
                <p className="mini-app-detail-desc">{shortDesc}</p>
              </section>
            )}

            <section className="mini-app-detail-section">
              <h3>Sự kiện</h3>
              <div className="mini-app-detail-events">
                <article className="mini-app-detail-event mini-app-detail-event--blue">
                  <strong>{data.name}</strong>
                  <p>Khám phá mini app nổi bật trên marketplace.</p>
                </article>
                <article
                  className={`mini-app-detail-event mini-app-detail-event--teal${free ? ' mini-app-detail-event--light' : ''}`}
                >
                  <strong>{free ? 'Miễn phí' : formatMiniAppPrice(data)}</strong>
                  <p>
                    {free
                      ? 'Sử dụng ngay không tốn credit.'
                      : 'Thông tin mới nhất từ chủ sở hữu.'}
                  </p>
                </article>
                <article className="mini-app-detail-event mini-app-detail-event--purple">
                  <strong>Sẵn sàng sử dụng</strong>
                  <p>Truy cập ngay mini app này trên AGI Center.</p>
                </article>
              </div>
            </section>

            <ReviewsSection rating={rating} ratingCount={ratingCount} reviews={reviews} />

            <section className="mini-app-detail-section mini-app-detail-section--divider">
              <h3>Chế độ riêng tư của ứng dụng</h3>
              <div className="mini-app-detail-privacy">
                <article className="mini-app-detail-event mini-app-detail-event--blue">
                  <strong>Phạm vi truy cập</strong>
                  <p>
                    {privacy === 'PUBLIC'
                      ? 'Mọi người dùng có thể xem và sử dụng mini app này.'
                      : 'Chỉ người được mời mới có thể truy cập mini app này.'}
                  </p>
                </article>
                <article className="mini-app-detail-event mini-app-detail-event--teal">
                  <strong>Dữ liệu người dùng</strong>
                  <p>Mini app chỉ truy cập dữ liệu cần thiết để vận hành tính năng.</p>
                </article>
                <article className="mini-app-detail-event mini-app-detail-event--purple">
                  <strong>Chia sẻ nội dung</strong>
                  <p>Nội dung bạn tạo tuân theo chính sách riêng tư của nền tảng.</p>
                </article>
              </div>
            </section>
          </div>
        )}

        {tab === 'content' && (
          <div className="mini-app-detail-body">
            <section className="mini-app-detail-section">
              <h3>Nội dung</h3>
              <p className="mini-app-detail-desc">{longDesc || shortDesc || 'Chưa có nội dung chi tiết.'}</p>
              {data.tags && data.tags.length > 0 && (
                <div className="mini-app-detail-tags">
                  {data.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {tab === 'reviews' && (
          <div className="mini-app-detail-body">
            <ReviewsSection
              rating={rating}
              ratingCount={ratingCount}
              reviews={reviews}
              title="Đánh giá người dùng"
            />
          </div>
        )}
      </div>

      <footer className="mini-app-detail-footer">
        <button type="button" className="mini-app-detail-use" onClick={handleUse}>
          <Zap size={16} />
          Sử dụng
        </button>
      </footer>
    </div>
  );
}
