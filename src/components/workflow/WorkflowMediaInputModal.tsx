import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Image,
  LayoutGrid,
  Link as LinkIcon,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { getGommoClient, loadAuth } from '../../services/authStore';
import {
  clampRandomRange,
  MEDIA_INPUT_PORTS,
  type MediaInputDraft,
  type MediaInputKind,
  type MediaSourceTab,
} from '../../services/workflowMediaInput';
import WorkflowMediaLibraryPicker from './WorkflowMediaLibraryPicker';

const TAB_ICONS: Record<MediaSourceTab, ReactNode> = {
  upload: <Upload size={13} />,
  library: <LayoutGrid size={13} />,
  extra: <Sparkles size={13} />,
  url: <LinkIcon size={13} />,
};

interface Props {
  open: boolean;
  kind: MediaInputKind;
  draft: MediaInputDraft;
  isNew: boolean;
  onSave: (draft: MediaInputDraft) => void;
  onDelete: () => void;
  onClose: () => void;
}

const IMAGE_TABS: { id: MediaSourceTab; label: string }[] = [
  { id: 'upload', label: 'Tải lên' },
  { id: 'library', label: 'Thư viện' },
  { id: 'extra', label: 'Extra' },
  { id: 'url', label: 'URL' },
];

const VIDEO_TABS: { id: MediaSourceTab; label: string }[] = [
  { id: 'upload', label: 'Tải lên' },
  { id: 'library', label: 'Thư viện' },
  { id: 'url', label: 'URL' },
];

export default function WorkflowMediaInputModal({
  open,
  kind,
  draft: initialDraft,
  isNew,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const [draft, setDraft] = useState<MediaInputDraft>(initialDraft);
  const [urlInput, setUrlInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(
    null,
  );
  const [error, setError] = useState('');
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setDraft(initialDraft);
      setUrlInput('');
      setError('');
      setUploadProgress(null);
      setLibraryPickerOpen(false);
    }
  }, [open, initialDraft]);

  useEffect(() => {
    const n = draft.mediaUrls.length;
    if (n === 0) return;
    setDraft((d) => {
      const { randomMin, randomMax } = clampRandomRange(n, d.randomMin, d.randomMax);
      if (randomMin === d.randomMin && randomMax === d.randomMax) return d;
      return { ...d, randomMin, randomMax };
    });
  }, [draft.mediaUrls.length]);

  if (!open) return null;

  const tabs = kind === 'image' ? IMAGE_TABS : VIDEO_TABS;
  const ports = MEDIA_INPUT_PORTS[kind];
  const title = kind === 'image' ? 'Nhập ảnh' : 'Nhập Video';
  const desc =
    kind === 'image'
      ? 'Chỉ ảnh (URL, tải lên). Cổng "Gộp ảnh" để nối nhiều nguồn ảnh vào cùng danh sách.'
      : 'Video (tải lên/album/URL). Cổng "Gộp video" để nối nhiều luồng video vào cùng danh sách.';

  const accept = kind === 'image' ? 'image/*' : 'video/*';

  const addUrl = (url: string, label?: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setDraft((d) => {
      if (d.mediaUrls.includes(trimmed)) return d;
      const nextUrls = [...d.mediaUrls, trimmed];
      const range = clampRandomRange(nextUrls.length, d.randomMin, d.randomMax);
      return {
        ...d,
        mediaUrls: nextUrls,
        fileNames: [...d.fileNames, label || trimmed],
        ...range,
      };
    });
    setUrlInput('');
  };

  const removeUrl = (index: number) => {
    setDraft((d) => {
      const nextUrls = d.mediaUrls.filter((_, i) => i !== index);
      const range = clampRandomRange(nextUrls.length, d.randomMin, d.randomMax);
      return {
        ...d,
        mediaUrls: nextUrls,
        fileNames: d.fileNames.filter((_, i) => i !== index),
        ...range,
      };
    });
  };

  const clearAllMedia = () => {
    setDraft((d) => ({ ...d, mediaUrls: [], fileNames: [], randomMin: 1, randomMax: 1 }));
  };

  const uploadSingleFile = async (file: File): Promise<boolean> => {
    const valid =
      kind === 'image'
        ? file.type.startsWith('image/')
        : file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(file.name);
    if (!valid) {
      setError(kind === 'image' ? 'Chỉ chấp nhận file ảnh' : 'Chỉ chấp nhận file video');
      return false;
    }
    if (!loadAuth()?.access_token) {
      setError('Cần đăng nhập để upload');
      return false;
    }
    const client = getGommoClient();
    const { url } =
      kind === 'image' ? await client.uploadImage(file) : await client.uploadVideo(file);
    setDraft((d) => {
      const nextUrls = [...d.mediaUrls, url];
      const range = clampRandomRange(nextUrls.length, d.randomMin, d.randomMax);
      return {
        ...d,
        mediaUrls: nextUrls,
        fileNames: [...d.fileNames, file.name],
        ...range,
      };
    });
    return true;
  };

  const handleUploadMany = async (files: FileList | File[] | null | undefined) => {
    const list = files ? Array.from(files) : [];
    if (!list.length) return;
    setUploading(true);
    setError('');
    setUploadProgress({ current: 0, total: list.length });
    try {
      for (let i = 0; i < list.length; i++) {
        setUploadProgress({ current: i + 1, total: list.length });
        await uploadSingleFile(list[i]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
      setUploadProgress(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDone = () => {
    if (draft.required && draft.mediaUrls.length === 0) {
      setError('Node bắt buộc — cần ít nhất một ảnh/video');
      return;
    }
    onSave(draft);
  };

  const mediaCount = draft.mediaUrls.length;
  const randomRange = clampRandomRange(mediaCount, draft.randomMin, draft.randomMax);

  const selectTab = (tabId: MediaSourceTab) => {
    if (tabId === 'upload') {
      setDraft((d) => ({ ...d, sourceTab: tabId }));
      window.setTimeout(() => fileRef.current?.click(), 0);
      return;
    }
    if (tabId === 'library') {
      setDraft((d) => ({ ...d, sourceTab: tabId }));
      setLibraryPickerOpen(true);
      return;
    }
    setDraft((d) => ({ ...d, sourceTab: tabId }));
  };

  const handleLibraryConfirm = (urls: string[], fileNames: string[]) => {
    setDraft((d) => {
      const range = clampRandomRange(urls.length, d.randomMin, d.randomMax);
      return { ...d, mediaUrls: urls, fileNames, ...range };
    });
    setLibraryPickerOpen(false);
  };

  const showBody =
    draft.sourceTab === 'url' ||
    (draft.sourceTab === 'extra' && kind === 'image') ||
    Boolean(error);

  return (
    <div className="wf-media-modal-overlay" onClick={onClose}>
      <div className="wf-media-modal" onClick={(e) => e.stopPropagation()}>
        <header className="wf-media-modal-head">
          <div className="wf-media-modal-title">
            <span className="wf-media-modal-icon">
              {kind === 'image' ? <Image size={16} /> : <Video size={16} />}
            </span>
            <div>
              <h3 className="wf-media-modal-h3">{title}</h3>
              <p className="wf-media-modal-desc">{desc}</p>
            </div>
          </div>
          <button type="button" className="wf-media-modal-x" onClick={onClose} aria-label="Đóng">
            <X size={16} />
          </button>
        </header>

        <input
          ref={fileRef}
          type="file"
          accept={accept}
          multiple
          className="sr-only"
          onChange={(e) => void handleUploadMany(e.target.files)}
        />

        <div
          className="wf-media-modal-tabs"
          style={{ ['--tab-count' as string]: tabs.length }}
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`wf-media-tab-btn${draft.sourceTab === t.id ? ' active' : ''}`}
              onClick={() => selectTab(t.id)}
            >
              {TAB_ICONS[t.id]}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {uploading && uploadProgress ? (
          <p className="wf-media-modal-status">
            <Loader2 size={14} className="wf-spin" /> Đang tải {uploadProgress.current}/
            {uploadProgress.total}…
          </p>
        ) : null}

        {mediaCount > 0 ? (
          <section className="wf-media-modal-preview-grid-wrap">
            <div className="wf-media-modal-preview-grid">
              {draft.mediaUrls.map((url, i) => (
                <div key={`${url}-${i}`} className="wf-media-modal-preview-cell">
                  {kind === 'image' ? (
                    <img src={url} alt="" />
                  ) : (
                    <video src={url} muted preload="metadata" playsInline />
                  )}
                  <button
                    type="button"
                    className="wf-media-modal-preview-remove"
                    onClick={() => removeUrl(i)}
                    title="Xóa"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <div className={`wf-media-modal-body${showBody ? '' : ' is-empty'}`}>
          {draft.sourceTab === 'extra' && kind === 'image' && (
            <div className="wf-media-modal-extra">
              <p className="wf-media-modal-empty">
                Thêm URL ảnh bổ sung (CDN, link ngoài) qua tab URL hoặc tải lên trực tiếp.
              </p>
            </div>
          )}

          {draft.sourceTab === 'url' && (
            <div className="wf-media-modal-url">
              <input
                type="url"
                value={urlInput}
                placeholder={kind === 'image' ? 'https://…/image.png' : 'https://…/video.mp4'}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addUrl(urlInput);
                  }
                }}
              />
              <button type="button" onClick={() => addUrl(urlInput)}>
                Thêm
              </button>
            </div>
          )}

          {error && <p className="wf-media-modal-error">{error}</p>}
        </div>

        <section className="wf-media-modal-settings">
          <h4 className="wf-media-settings-title">
            <span className="wf-media-settings-dot" />
            SETTINGS
          </h4>

          <div className="wf-media-toggle-row">
            <div className="wf-media-toggle-info">
              <strong>Random Output</strong>
              <small>
                {kind === 'image'
                  ? 'Mỗi lần chạy sẽ random chọn ảnh trong khoảng đã chọn.'
                  : 'Mỗi lần chạy sẽ random chọn video trong khoảng đã chọn.'}
              </small>
            </div>
            <label className="wf-media-switch">
              <input
                type="checkbox"
                checked={draft.randomOutput}
                onChange={(e) =>
                  setDraft((d) => {
                    const range = clampRandomRange(
                      d.mediaUrls.length || 1,
                      1,
                      d.mediaUrls.length || 1,
                    );
                    return {
                      ...d,
                      randomOutput: e.target.checked,
                      randomMin: range.randomMin,
                      randomMax: range.randomMax,
                    };
                  })
                }
              />
              <span className="wf-media-switch-track" />
            </label>
          </div>

          {draft.randomOutput && (
            <div className="wf-media-random-range">
              <label className="wf-media-random-field">
                <span>Min</span>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, randomRange.randomMax)}
                  value={randomRange.randomMin}
                  disabled={mediaCount === 0}
                  onChange={(e) => {
                    const min = Number(e.target.value) || 1;
                    setDraft((d) => {
                      const range = clampRandomRange(mediaCount || 1, min, d.randomMax);
                      return { ...d, ...range };
                    });
                  }}
                />
              </label>
              <span className="wf-media-random-dash" aria-hidden>
                —
              </span>
              <label className="wf-media-random-field">
                <span>Max</span>
                <input
                  type="number"
                  min={randomRange.randomMin}
                  max={Math.max(1, mediaCount)}
                  value={randomRange.randomMax}
                  disabled={mediaCount === 0}
                  onChange={(e) => {
                    const max = Number(e.target.value) || Math.max(1, mediaCount);
                    setDraft((d) => {
                      const range = clampRandomRange(mediaCount || 1, d.randomMin, max);
                      return { ...d, ...range };
                    });
                  }}
                />
              </label>
              <span className="wf-media-random-total">
                Total <strong>{mediaCount}</strong>
              </span>
            </div>
          )}

          <div className="wf-media-toggle-row">
            <div className="wf-media-toggle-info">
              <strong>Chỉ dùng 1 lần</strong>
              <small>
                {kind === 'image'
                  ? 'Mỗi ảnh chỉ được dùng 1 lần, sau khi dùng sẽ bị khóa.'
                  : 'Mỗi video chỉ được dùng 1 lần, sau khi dùng sẽ bị khóa.'}
              </small>
            </div>
            <label className="wf-media-switch">
              <input
                type="checkbox"
                checked={draft.useOnce}
                onChange={(e) => setDraft((d) => ({ ...d, useOnce: e.target.checked }))}
              />
              <span className="wf-media-switch-track" />
            </label>
          </div>
        </section>

        <section className="wf-media-modal-ports">
          <h4 className="wf-media-settings-title">
            <span className="wf-media-settings-dot" />
            CỔNG KẾT NỐI
          </h4>
          <div className="wf-media-ports-grid-v2">
            <div className="wf-media-ports-col">
              <span className="wf-media-ports-col-label">Đầu vào</span>
              {ports.in.map((p) => (
                <div key={p.id} className="wf-media-port-row-v2">
                  <span className="wf-media-port-dot-v2" style={{ background: p.color }} />
                  <span className="wf-media-port-name">{p.label}</span>
                  <code className="wf-media-port-badge">{p.id}</code>
                </div>
              ))}
            </div>
            <div className="wf-media-ports-col">
              <span className="wf-media-ports-col-label">Đầu ra</span>
              {ports.out.map((p) => (
                <div key={p.id} className="wf-media-port-row-v2">
                  <span className="wf-media-port-dot-v2" style={{ background: p.color }} />
                  <span className="wf-media-port-name">{p.label}</span>
                  <code className="wf-media-port-badge">{p.id}</code>
                </div>
              ))}
            </div>
          </div>
        </section>

        <footer className="wf-media-modal-foot">
          <div className="wf-media-foot-left">
            {!isNew && (
              <button type="button" className="wf-media-modal-delete" onClick={onDelete}>
                <Trash2 size={13} />
                Xóa Node
              </button>
            )}
            {draft.mediaUrls.length > 0 && (
              <button type="button" className="wf-media-modal-clear" onClick={clearAllMedia}>
                Xóa tất cả
              </button>
            )}
            <label className="wf-media-modal-required">
              <input
                type="checkbox"
                checked={draft.required}
                onChange={(e) => setDraft((d) => ({ ...d, required: e.target.checked }))}
              />
              <span>Bắt buộc</span>
            </label>
          </div>
          <button type="button" className="wf-media-modal-done" onClick={handleDone}>
            Xong
          </button>
        </footer>

        <WorkflowMediaLibraryPicker
          open={libraryPickerOpen}
          kind={kind}
          initialUrls={draft.mediaUrls}
          onConfirm={handleLibraryConfirm}
          onCancel={() => setLibraryPickerOpen(false)}
        />
      </div>
    </div>
  );
}
