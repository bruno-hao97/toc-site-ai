import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Flag,
  Loader2,
  Maximize2,
  Pencil,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
  Video,
  Wand2,
  X,
} from 'lucide-react';
import { getDisplayUser } from '../services/authStore';
import {
  feedMediaUrl,
  feedPosterUrl,
  feedThumb,
  type FeedItem,
} from '../services/feedApi';
import {
  feedCreatedDateLabel,
  feedDimensionsLabel,
  feedModelDisplay,
  feedQualityLabel,
  feedRatioLabel,
  feedRefThumb,
  feedTimeAgo,
  formatFileSize,
} from '../services/feedLibraryMeta';
import {
  fetchUpscaleModels,
  pickUpscaleModel,
  resolveUpscalePrice,
  runImageUpscale,
} from '../services/imageUpscale';
import { isModelAvailable, normalizeOptions } from '../services/modelSchema';
import { downloadMediaUrl } from '../utils/downloadMedia';
import { probeFileSize } from '../utils/probeFileSize';
import { isJobAcceptedPendingError } from '../services/jobInfraErrors';
import { useLocale } from '../i18n';

export type ComposerPreviewHandlers = {
  onRegenerate?: () => void;
  onReuse?: () => void;
  onPublish?: () => void;
  onCreateVideo?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onUpscaleDone?: (resultUrl: string) => void;
};

const PROMPT_COLLAPSE_LEN = 180;

export default function ComposerLibraryPreviewModal({
  items,
  index,
  kind,
  layout = 'composer',
  onClose,
  onNavigate,
  handlers = {},
  deleting = false,
}: {
  items: FeedItem[];
  index: number;
  kind: 'image' | 'video';
  layout?: 'composer' | 'home';
  onClose: () => void;
  onNavigate: (index: number) => void;
  handlers?: ComposerPreviewHandlers;
  deleting?: boolean;
}) {
  const { t } = useLocale();
  const item = items[index];
  const playUrl = item ? feedMediaUrl(item) || feedThumb(item) : null;
  const poster = item ? feedPosterUrl(item) : null;
  const canPrev = index > 0;
  const canNext = index < items.length - 1;
  const isHomeLayout = layout === 'home';
  const isHomeVideo = isHomeLayout && kind === 'video';

  const [upscaleOpen, setUpscaleOpen] = useState(false);
  const [upscaleMode, setUpscaleMode] = useState('');
  const [upscaleRes, setUpscaleRes] = useState('');
  const [upscaleLoading, setUpscaleLoading] = useState(false);
  const [upscaleBusy, setUpscaleBusy] = useState(false);
  const [upscaleError, setUpscaleError] = useState('');
  const [upscaleStatus, setUpscaleStatus] = useState('');
  const [upscaleModel, setUpscaleModel] = useState<Awaited<ReturnType<typeof fetchUpscaleModels>>[0] | null>(null);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [reportMsg, setReportMsg] = useState('');
  const [soonMsg, setSoonMsg] = useState('');
  const [probedSize, setProbedSize] = useState<number | null>(null);

  const {
    onRegenerate,
    onReuse,
    onPublish,
    onCreateVideo,
    onEdit,
    onDelete,
    onUpscaleDone,
  } = handlers;

  const me = getDisplayUser();

  useEffect(() => {
    setPromptExpanded(false);
    setReportMsg('');
    setSoonMsg('');
    setProbedSize(null);
  }, [item?.id_base]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (upscaleOpen) setUpscaleOpen(false);
        else onClose();
      }
      if (!upscaleOpen) {
        if (e.key === 'ArrowLeft' && canPrev) onNavigate(index - 1);
        if (e.key === 'ArrowRight' && canNext) onNavigate(index + 1);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index, canPrev, canNext, onClose, onNavigate, upscaleOpen]);

  useEffect(() => {
    if (!playUrl || (item?.file_size && item.file_size > 0)) return;
    let cancelled = false;
    void probeFileSize(playUrl).then((n) => {
      if (!cancelled && n) setProbedSize(n);
    });
    return () => {
      cancelled = true;
    };
  }, [playUrl, item?.file_size]);

  const loadUpscaleModel = useCallback(async () => {
    setUpscaleLoading(true);
    setUpscaleError('');
    try {
      const models = await fetchUpscaleModels();
      const model = pickUpscaleModel(models);
      if (!model) throw new Error(t('composer.preview.upscaleModelMissing'));
      setUpscaleModel(model);
      const modes = normalizeOptions(model.mode || model.modes);
      const resolutions = normalizeOptions(model.resolutions);
      setUpscaleMode(modes[0]?.value || 'standard');
      setUpscaleRes(resolutions[0]?.value || '2k');
      if (!isModelAvailable(model) && model.status_message) {
        setUpscaleError(model.status_message);
      }
    } catch (e) {
      setUpscaleError(e instanceof Error ? e.message : String(e));
    } finally {
      setUpscaleLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (upscaleOpen && !upscaleModel && !upscaleLoading) {
      void loadUpscaleModel();
    }
  }, [upscaleOpen, upscaleModel, upscaleLoading, loadUpscaleModel]);

  const upscalePrice = useMemo(() => {
    if (!upscaleModel || !upscaleMode || !upscaleRes) return undefined;
    return resolveUpscalePrice(upscaleModel, upscaleMode, upscaleRes);
  }, [upscaleModel, upscaleMode, upscaleRes]);

  const upscaleModes = useMemo(
    () => (upscaleModel ? normalizeOptions(upscaleModel.mode || upscaleModel.modes) : []),
    [upscaleModel],
  );
  const upscaleResolutions = useMemo(
    () => (upscaleModel ? normalizeOptions(upscaleModel.resolutions) : []),
    [upscaleModel],
  );

  if (!item || !playUrl) return null;

  const model = feedModelDisplay(item);
  const quality = feedQualityLabel(item);
  const dimensions = feedDimensionsLabel(item);
  const ratio = feedRatioLabel(item);
  const createdDate = feedCreatedDateLabel(item);
  const size = formatFileSize(item.file_size || probedSize || undefined);
  const prompt = (item.prompt || item.title || '').trim();
  const isImage = kind === 'image';
  const kindTag = isImage ? 'v-image' : 'v-video';
  const authorName =
    item.author?.name?.trim()
    || item.author?.username?.trim()
    || me.name
    || me.username
    || t('composer.preview.defaultAuthor');
  const authorAvatar = item.author?.avatar || me.avatar;
  const refImages = [
    ...(item.images ?? []),
    ...(item.objects ?? []),
  ].filter((r) => r.url?.trim());
  const primaryRef = feedRefThumb(item);
  const promptLong = prompt.length > PROMPT_COLLAPSE_LEN;
  const promptShown =
    promptExpanded || !promptLong
      ? prompt
      : `${prompt.slice(0, PROMPT_COLLAPSE_LEN).trim()}…`;

  async function copyPrompt() {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      /* ignore */
    }
  }

  function showSoon(feature: string) {
    setSoonMsg(t('composer.preview.soon', { feature }));
    window.setTimeout(() => setSoonMsg(''), 2800);
  }

  function reportIssue() {
    setReportMsg(t('composer.preview.reportDone'));
    window.setTimeout(() => setReportMsg(''), 2800);
  }

  async function handleUpscaleSubmit() {
    if (!playUrl || !upscaleMode || !upscaleRes || upscaleBusy) return;
    setUpscaleBusy(true);
    setUpscaleError('');
    setUpscaleStatus(t('composer.preview.upscaleStarting'));
    try {
      const resultUrl = await runImageUpscale(playUrl, {
        mode: upscaleMode,
        resolution: upscaleRes,
        modelId: upscaleModel?.model || upscaleModel?.slug,
      }, setUpscaleStatus);
      onUpscaleDone?.(resultUrl);
      setUpscaleOpen(false);
      void downloadMediaUrl(resultUrl);
      setUpscaleStatus('');
      setUpscaleBusy(false);
    } catch (e) {
      if (isJobAcceptedPendingError(e)) {
        setUpscaleError('');
        setUpscaleStatus(e.message);
        window.setTimeout(() => setUpscaleBusy(false), 45_000);
        return;
      }
      setUpscaleError(e instanceof Error ? e.message : String(e));
      setUpscaleStatus('');
      setUpscaleBusy(false);
    }
  }

  return createPortal(
    <div className="clib-preview-backdrop" onClick={onClose}>
      <div
        className={`clib-preview${isHomeLayout ? ' clib-preview--home' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="clib-preview-main">
          {canPrev && (
            <button
              type="button"
              className="clib-preview-nav prev"
              aria-label={t('composer.preview.ariaPrev')}
              onClick={() => onNavigate(index - 1)}
            >
              <ChevronLeft size={28} />
            </button>
          )}

          <div className="clib-preview-stage">
            {kind === 'video' ? (
              <video
                key={item.id_base}
                src={playUrl}
                poster={poster || undefined}
                controls
                playsInline
                className="clib-preview-media"
              />
            ) : (
              <img src={playUrl} alt="" className="clib-preview-media" />
            )}
          </div>

          {canNext && (
            <button
              type="button"
              className="clib-preview-nav next"
              aria-label={t('composer.preview.ariaNext')}
              onClick={() => onNavigate(index + 1)}
            >
              <ChevronRight size={28} />
            </button>
          )}
        </div>

        <aside className="clib-preview-side">
          <header className="clib-preview-side-head">
            <div className="clib-preview-user-row">
              {authorAvatar ? (
                <img className="clib-preview-avatar" src={authorAvatar} alt="" />
              ) : (
                <span className="clib-preview-avatar clib-preview-avatar-empty" />
              )}
              <div className="clib-preview-user-meta">
                <span className="clib-preview-user">
                  {authorName}
                  <span className="clib-preview-online" title="Online" />
                </span>
                <span className="clib-preview-time">{feedTimeAgo(item.created_time)}</span>
              </div>
            </div>
            <button type="button" className="clib-preview-close" aria-label={t('composer.aria.close')} onClick={onClose}>
              <X size={18} />
            </button>
          </header>

          {prompt && (
            <div className="clib-preview-prompt">
              <div className="clib-preview-prompt-head">
                <span className="clib-preview-kind-tag">{kindTag}</span>
                <button
                  type="button"
                  className="clib-preview-copy-text"
                  onClick={() => void copyPrompt()}
                >
                  <Copy size={13} /> {t('composer.preview.copy')}
                </button>
              </div>
              <p>{promptShown}</p>
              <div className="clib-preview-prompt-foot">
                {promptLong && (
                  <button
                    type="button"
                    className="clib-preview-link-btn"
                    onClick={() => setPromptExpanded((v) => !v)}
                  >
                    {promptExpanded ? t('composer.preview.showLess') : t('composer.preview.showMore')}
                  </button>
                )}
                <button
                  type="button"
                  className="clib-preview-link-btn"
                  onClick={reportIssue}
                >
                  <Flag size={12} /> {t('composer.preview.report')}
                </button>
              </div>
              {reportMsg && <p className="clib-preview-toast">{reportMsg}</p>}
            </div>
          )}

          <section className="clib-preview-info">
            <h4>{isHomeVideo ? t('composer.preview.infoVideo') : isHomeLayout ? t('composer.preview.infoImage') : t('composer.preview.info')}</h4>
            <dl>
              {model && (
                <>
                  <dt>{t('composer.preview.label.model')}</dt>
                  <dd className="accent-gold">{model}</dd>
                </>
              )}
              {quality && (
                <>
                  <dt>{t('composer.preview.label.quality')}</dt>
                  <dd className="accent-cyan">{quality}</dd>
                </>
              )}
              {dimensions && (
                <>
                  <dt>{t('composer.preview.label.dimensions')}</dt>
                  <dd className="accent-cyan">{dimensions}</dd>
                </>
              )}
              {size && (
                <>
                  <dt>{t('composer.preview.label.fileSize')}</dt>
                  <dd className="accent-green">{size}</dd>
                </>
              )}
              {item.duration && Number(item.duration) > 0 && kind === 'video' && (
                <>
                  <dt>{t('composer.preview.label.duration')}</dt>
                  <dd className="accent-cyan">{item.duration}s</dd>
                </>
              )}
              {ratio && (
                <>
                  <dt>{t('composer.preview.label.ratio')}</dt>
                  <dd className="accent-cyan">{ratio}</dd>
                </>
              )}
              {createdDate && (
                <>
                  <dt>{t('composer.preview.label.created')}</dt>
                  <dd className="accent-cyan">{createdDate}</dd>
                </>
              )}
            </dl>
            {playUrl && (
              <a
                className="clib-preview-media-link"
                href={playUrl}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={13} />
                {kind === 'video' ? t('composer.preview.viewVideo') : t('composer.preview.viewImage')}
              </a>
            )}
          </section>

          <section className="clib-preview-refs">
            <h4>{t('composer.preview.refs')}</h4>
            <div className="clib-preview-refs-grid">
              {(refImages.length ? refImages : primaryRef ? [{ url: primaryRef }] : []).length > 0 ? (
                (refImages.length ? refImages : primaryRef ? [{ url: primaryRef }] : []).map(
                  (ref, i) => (
                    <a
                      key={`${ref.url}-${i}`}
                      className="clib-preview-ref-thumb"
                      href={ref.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img src={ref.url} alt="" loading="lazy" />
                    </a>
                  ),
                )
              ) : (
                <span className="clib-preview-ref-empty">{t('composer.preview.noRefs')}</span>
              )}
            </div>
          </section>

          {soonMsg && <p className="clib-preview-toast">{soonMsg}</p>}

          {upscaleOpen && isImage ? (
            <div className="clib-upscale-panel">
              <div className="clib-upscale-head">
                <h4>{t('composer.preview.upscaleTitle')}</h4>
                <button type="button" className="clib-upscale-back" onClick={() => setUpscaleOpen(false)}>
                  <ChevronLeft size={16} />
                  {t('composer.back')}
                </button>
              </div>
              {upscaleLoading ? (
                <p className="clib-upscale-status">
                  <Loader2 size={16} className="clib-spin" /> {t('composer.preview.upscaleLoading')}
                </p>
              ) : (
                <>
                  {upscaleModel?.name && (
                    <p className="clib-upscale-model">{upscaleModel.name}</p>
                  )}
                  <label className="clib-upscale-field">
                    <span>{t('composer.preview.upscaleMode')}</span>
                    <select
                      value={upscaleMode}
                      onChange={(e) => setUpscaleMode(e.target.value)}
                      disabled={upscaleBusy}
                    >
                      {upscaleModes.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="clib-upscale-field">
                    <span>{t('composer.preview.upscaleResolution')}</span>
                    <select
                      value={upscaleRes}
                      onChange={(e) => setUpscaleRes(e.target.value)}
                      disabled={upscaleBusy}
                    >
                      {upscaleResolutions.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {upscalePrice != null && (
                    <p className="clib-upscale-price">{t('composer.preview.upscalePrice', { price: upscalePrice })}</p>
                  )}
                  {upscaleStatus && (
                    <p className="clib-upscale-status">{upscaleStatus}</p>
                  )}
                  {upscaleError && <p className="clib-upscale-error">{upscaleError}</p>}
                  <button
                    type="button"
                    className="clib-preview-regenerate"
                    disabled={upscaleBusy || Boolean(upscaleError && !upscaleModel)}
                    onClick={() => void handleUpscaleSubmit()}
                  >
                    {upscaleBusy ? (
                      <>
                        <Loader2 size={16} className="clib-spin" />
                        {t('composer.preview.upscaleBusy')}
                      </>
                    ) : (
                      <>
                        <Maximize2 size={16} />
                        {t('composer.preview.upscaleStart')}
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          ) : isHomeLayout ? (
            <div className="clib-preview-actions-vmedia">
              <button
                type="button"
                className="clib-preview-regenerate clib-preview-regenerate--gold"
                disabled={!onRegenerate}
                onClick={onRegenerate}
              >
                <RotateCcw size={16} />
                {t('composer.preview.regenerate')}
              </button>
              {isHomeVideo ? (
                <>
                  <button
                    type="button"
                    className="clib-preview-action-row"
                    onClick={() => showSoon(t('composer.preview.upscaleVideo'))}
                  >
                    <Maximize2 size={16} />
                    {t('composer.preview.upscaleVideo')}
                  </button>
                  <button
                    type="button"
                    className="clib-preview-action-row"
                    onClick={() => showSoon(t('composer.preview.enhanceDesign'))}
                  >
                    <Sparkles size={16} />
                    {t('composer.preview.enhanceDesign')}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="clib-preview-action-row"
                    onClick={() => {
                      setUpscaleOpen(true);
                      setUpscaleError('');
                    }}
                  >
                    <Maximize2 size={16} />
                    {t('composer.preview.upscale')}
                  </button>
                  <button
                    type="button"
                    className="clib-preview-action-row"
                    onClick={() => showSoon(t('composer.preview.enhanceDesign'))}
                  >
                    <Sparkles size={16} />
                    {t('composer.preview.enhanceDesign')}
                  </button>
                </>
              )}
              <div className="clib-preview-actions-grid">
                <button
                  type="button"
                  className="clib-preview-action-tile"
                  disabled={!onReuse && !onRegenerate}
                  onClick={onReuse || onRegenerate}
                >
                  <Copy size={18} />
                  <span>{t('composer.action.reuse')}</span>
                </button>
                <button
                  type="button"
                  className="clib-preview-action-tile"
                  onClick={() => void downloadMediaUrl(playUrl)}
                >
                  <Download size={18} />
                  <span>{t('composer.preview.download')}</span>
                </button>
              </div>
              <div className="clib-preview-actions-grid">
                <button
                  type="button"
                  className="clib-preview-action-tile"
                  disabled={!onEdit}
                  onClick={onEdit}
                >
                  <Wand2 size={18} />
                  <span>{isHomeVideo ? t('composer.video.edit') : t('composer.preview.edit')}</span>
                </button>
                <button
                  type="button"
                  className="clib-preview-action-tile danger"
                  disabled={deleting || !onDelete}
                  onClick={onDelete}
                >
                  <Trash2 size={18} />
                  <span>{deleting ? t('composer.preview.deleting') : t('composer.action.deleteOne')}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="clib-preview-actions-v2">
              <button
                type="button"
                className="clib-preview-regenerate"
                disabled={!onRegenerate}
                onClick={onRegenerate}
              >
                <RotateCcw size={16} />
                {t('composer.preview.regenerate')}
              </button>
              <div className="clib-preview-actions-grid">
                <button
                  type="button"
                  className="clib-preview-action-tile"
                  disabled={!onPublish}
                  title={onPublish ? undefined : t('composer.preview.notSupported')}
                  onClick={onPublish}
                >
                  <Upload size={18} />
                  <span>{t('composer.preview.publish')}</span>
                </button>
                <button
                  type="button"
                  className="clib-preview-action-tile"
                  disabled={!isImage || !onCreateVideo}
                  onClick={onCreateVideo}
                >
                  <Video size={18} />
                  <span>{t('jobType.video')}</span>
                </button>
                <button
                  type="button"
                  className="clib-preview-action-tile"
                  onClick={() => void downloadMediaUrl(playUrl)}
                >
                  <Download size={18} />
                  <span>{t('composer.preview.download')}</span>
                </button>
                <button
                  type="button"
                  className="clib-preview-action-tile"
                  disabled={!isImage}
                  onClick={() => {
                    setUpscaleOpen(true);
                    setUpscaleError('');
                  }}
                >
                  <Maximize2 size={18} />
                  <span>{t('composer.preview.upscale')}</span>
                </button>
                <button
                  type="button"
                  className="clib-preview-action-tile"
                  disabled={!onEdit}
                  onClick={onEdit}
                >
                  <Pencil size={18} />
                  <span>{t('composer.preview.edit')}</span>
                </button>
                <button
                  type="button"
                  className="clib-preview-action-tile danger"
                  disabled={deleting || !onDelete}
                  onClick={onDelete}
                >
                  <Trash2 size={18} />
                  <span>{deleting ? t('composer.preview.deleting') : t('composer.action.deleteOne')}</span>
                </button>
              </div>
            </div>
          )}
        </aside>

        <div className="clib-preview-thumbs">
          {items.map((it, i) => {
            const thumb = feedPosterUrl(it) || feedThumb(it);
            if (!thumb) return null;
            return (
              <button
                key={it.id_base || i}
                type="button"
                className={`clib-preview-thumb${i === index ? ' active' : ''}`}
                onClick={() => onNavigate(i)}
              >
                <img src={thumb} alt="" loading="lazy" />
                {it.type !== 'image' && (
                  <span className="clib-preview-thumb-play" aria-hidden>
                    ▶
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
