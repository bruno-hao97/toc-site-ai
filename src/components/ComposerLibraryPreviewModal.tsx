import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Loader2,
  Maximize2,
  Pencil,
  RotateCcw,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react';
import {
  feedMediaUrl,
  feedThumb,
  type FeedItem,
} from '../services/feedApi';
import {
  feedCreatedDateLabel,
  feedDimensionsLabel,
  feedModelDisplay,
  feedRatioLabel,
  feedResolutionLabel,
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

export type ComposerPreviewHandlers = {
  onRegenerate?: () => void;
  onPublish?: () => void;
  onCreateVideo?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onUpscaleDone?: (resultUrl: string) => void;
};

export default function ComposerLibraryPreviewModal({
  items,
  index,
  kind,
  onClose,
  onNavigate,
  handlers = {},
  deleting = false,
}: {
  items: FeedItem[];
  index: number;
  kind: 'image' | 'video';
  onClose: () => void;
  onNavigate: (index: number) => void;
  handlers?: ComposerPreviewHandlers;
  deleting?: boolean;
}) {
  const item = items[index];
  const mediaUrl = item ? feedMediaUrl(item) || feedThumb(item) : null;
  const canPrev = index > 0;
  const canNext = index < items.length - 1;

  const [upscaleOpen, setUpscaleOpen] = useState(false);
  const [upscaleMode, setUpscaleMode] = useState('');
  const [upscaleRes, setUpscaleRes] = useState('');
  const [upscaleLoading, setUpscaleLoading] = useState(false);
  const [upscaleBusy, setUpscaleBusy] = useState(false);
  const [upscaleError, setUpscaleError] = useState('');
  const [upscaleStatus, setUpscaleStatus] = useState('');
  const [upscaleModel, setUpscaleModel] = useState<Awaited<ReturnType<typeof fetchUpscaleModels>>[0] | null>(null);

  const {
    onRegenerate,
    onPublish,
    onCreateVideo,
    onEdit,
    onDelete,
    onUpscaleDone,
  } = handlers;

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

  const loadUpscaleModel = useCallback(async () => {
    setUpscaleLoading(true);
    setUpscaleError('');
    try {
      const models = await fetchUpscaleModels();
      const model = pickUpscaleModel(models);
      if (!model) throw new Error('Không tìm thấy model upscale');
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
  }, []);

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

  if (!item || !mediaUrl) return null;

  const model = feedModelDisplay(item);
  const quality = feedResolutionLabel(item);
  const dimensions = feedDimensionsLabel(item);
  const ratio = feedRatioLabel(item);
  const createdDate = feedCreatedDateLabel(item);
  const size = formatFileSize(item.file_size);
  const prompt = (item.prompt || '').trim();
  const isImage = kind === 'image';

  async function copyPrompt() {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      /* ignore */
    }
  }

  async function handleUpscaleSubmit() {
    if (!mediaUrl || !upscaleMode || !upscaleRes || upscaleBusy) return;
    setUpscaleBusy(true);
    setUpscaleError('');
    setUpscaleStatus('Đang bắt đầu…');
    try {
      const resultUrl = await runImageUpscale(mediaUrl, {
        mode: upscaleMode,
        resolution: upscaleRes,
        modelId: upscaleModel?.model || upscaleModel?.slug,
      }, setUpscaleStatus);
      onUpscaleDone?.(resultUrl);
      setUpscaleOpen(false);
      void downloadMediaUrl(resultUrl);
    } catch (e) {
      setUpscaleError(e instanceof Error ? e.message : String(e));
    } finally {
      setUpscaleBusy(false);
      setUpscaleStatus('');
    }
  }

  return createPortal(
    <div className="clib-preview-backdrop" onClick={onClose}>
      <div className="clib-preview" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="clib-preview-close" aria-label="Đóng" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="clib-preview-main">
          {canPrev && (
            <button
              type="button"
              className="clib-preview-nav prev"
              aria-label="Trước"
              onClick={() => onNavigate(index - 1)}
            >
              <ChevronLeft size={28} />
            </button>
          )}

          <div className="clib-preview-stage">
            {kind === 'video' ? (
              <video src={mediaUrl} controls autoPlay className="clib-preview-media" />
            ) : (
              <img src={mediaUrl} alt="" className="clib-preview-media" />
            )}
          </div>

          {canNext && (
            <button
              type="button"
              className="clib-preview-nav next"
              aria-label="Sau"
              onClick={() => onNavigate(index + 1)}
            >
              <ChevronRight size={28} />
            </button>
          )}
        </div>

        <aside className="clib-preview-side">
          <header className="clib-preview-side-head">
            <span className="clib-preview-user">Bạn</span>
            <span className="clib-preview-time">{feedTimeAgo(item.created_time)}</span>
          </header>

          {prompt && (
            <div className="clib-preview-prompt">
              <p>&ldquo;{prompt}&rdquo;</p>
              <button type="button" className="clib-preview-copy" onClick={() => void copyPrompt()}>
                <Copy size={14} />
              </button>
            </div>
          )}

          <section className="clib-preview-info">
            <h4>Thông tin</h4>
            <dl>
              {model && (
                <>
                  <dt>Model</dt>
                  <dd className="accent-gold">{model}</dd>
                </>
              )}
              {quality && (
                <>
                  <dt>Chất lượng</dt>
                  <dd className="accent-cyan">{quality}</dd>
                </>
              )}
              {dimensions && (
                <>
                  <dt>Kích thước</dt>
                  <dd className="accent-cyan">{dimensions}</dd>
                </>
              )}
              {size && (
                <>
                  <dt>Dung lượng</dt>
                  <dd className="accent-green">{size}</dd>
                </>
              )}
              {ratio && (
                <>
                  <dt>Tỷ lệ</dt>
                  <dd className="accent-cyan">{ratio}</dd>
                </>
              )}
              {createdDate && (
                <>
                  <dt>Ngày tạo</dt>
                  <dd className="accent-cyan">{createdDate}</dd>
                </>
              )}
            </dl>
          </section>

          {upscaleOpen && isImage ? (
            <div className="clib-upscale-panel">
              <div className="clib-upscale-head">
                <h4>Upscale ảnh</h4>
                <button type="button" className="clib-upscale-back" onClick={() => setUpscaleOpen(false)}>
                  <ChevronLeft size={16} />
                  Quay lại
                </button>
              </div>
              {upscaleLoading ? (
                <p className="clib-upscale-status">
                  <Loader2 size={16} className="clib-spin" /> Đang tải model…
                </p>
              ) : (
                <>
                  {upscaleModel?.name && (
                    <p className="clib-upscale-model">{upscaleModel.name}</p>
                  )}
                  <label className="clib-upscale-field">
                    <span>Chế độ</span>
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
                    <span>Độ phân giải</span>
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
                    <p className="clib-upscale-price">Chi phí: {upscalePrice} credit</p>
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
                        Đang upscale…
                      </>
                    ) : (
                      <>
                        <Maximize2 size={16} />
                        Bắt đầu upscale
                      </>
                    )}
                  </button>
                </>
              )}
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
                Tạo lại
              </button>
              <div className="clib-preview-actions-grid">
                <button
                  type="button"
                  className="clib-preview-action-tile"
                  disabled
                  title="Chưa hỗ trợ"
                >
                  <Upload size={18} />
                  <span>Đăng tải</span>
                </button>
                <button
                  type="button"
                  className="clib-preview-action-tile"
                  disabled={!isImage || !onCreateVideo}
                  onClick={onCreateVideo}
                >
                  <Video size={18} />
                  <span>Video</span>
                </button>
                <button
                  type="button"
                  className="clib-preview-action-tile"
                  onClick={() => void downloadMediaUrl(mediaUrl)}
                >
                  <Download size={18} />
                  <span>Tải xuống</span>
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
                  <span>Upscale ảnh</span>
                </button>
                <button
                  type="button"
                  className="clib-preview-action-tile"
                  disabled={!onEdit}
                  onClick={onEdit}
                >
                  <Pencil size={18} />
                  <span>Chỉnh sửa</span>
                </button>
                <button
                  type="button"
                  className="clib-preview-action-tile danger"
                  disabled={deleting || !onDelete}
                  onClick={onDelete}
                >
                  <Trash2 size={18} />
                  <span>{deleting ? 'Đang xóa…' : 'Xóa'}</span>
                </button>
              </div>
            </div>
          )}
        </aside>

        <div className="clib-preview-thumbs">
          {items.map((it, i) => {
            const thumb = feedThumb(it);
            if (!thumb) return null;
            return (
              <button
                key={it.id_base || i}
                type="button"
                className={`clib-preview-thumb${i === index ? ' active' : ''}`}
                onClick={() => onNavigate(i)}
              >
                {kind === 'video' ? (
                  <video src={thumb} muted preload="metadata" />
                ) : (
                  <img src={thumb} alt="" loading="lazy" />
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
