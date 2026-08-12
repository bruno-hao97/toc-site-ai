import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { anchoredPanelStyle, useAnchoredDropdown } from '../hooks/useAnchoredDropdown';
import {
  Bot,
  ChevronDown,
  ChevronUp,
  Clapperboard,
  Clock,
  FileText,
  Image as ImageIcon,
  LayoutGrid,
  Loader2,
  Mic,
  Monitor,
  Music,
  Plus,
  Proportions,
  SendHorizontal,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';
import ComposerMediaPickButton from './ComposerMediaPickButton';
import type { GommoModel, JobType } from '../services/api';
import type { JobSelections, ModelOption, ModelSchema } from '../services/modelSchema';
import { mergeSelectionsForSchema, modelSlug, normalizeComponentSelections } from '../services/modelSchema';
import {
  buildQuickSchema,
  canQuickCreate,
  loadQuickModels,
  quickGenerate,
  uploadQuickImage,
  uploadQuickMedia,
} from '../services/quickCreate';
import { notifyCreditsUpdated } from '../services/authStore';
import { modelPriceRangeLabel, resolveModelPrice } from '../services/modelPricing';
import { isJobAcceptedPendingError } from '../services/jobInfraErrors';

type QuickMenuId = 'chat' | 'script' | 'video' | 'image' | 'tts' | 'music' | 'audio' | 'apps';

interface QuickMenuItem {
  id: QuickMenuId;
  label: string;
  icon: typeof ImageIcon;
  jobType?: JobType;
  href?: string;
  action?: 'open-chat';
  fixedCount?: number;
}

const QUICK_MENU: QuickMenuItem[] = [
  { id: 'chat', label: 'Chat', icon: Bot, action: 'open-chat', fixedCount: 1 },
  { id: 'script', label: 'Tạo kịch bản', icon: FileText, href: '/video', fixedCount: 1 },
  { id: 'video', label: 'Tạo video', icon: Clapperboard, jobType: 'video' },
  { id: 'image', label: 'Tạo ảnh', icon: ImageIcon, jobType: 'image' },
  { id: 'tts', label: 'Tạo giọng đọc', icon: Volume2, jobType: 'tts' },
  { id: 'music', label: 'Tạo nhạc', icon: Music, jobType: 'music' },
  { id: 'audio', label: 'Âm thanh', icon: Mic, href: '/audio', fixedCount: 1 },
  { id: 'apps', label: 'Ứng dụng', icon: LayoutGrid, href: '/workflow', fixedCount: 1 },
];

const JOB_TYPES: JobType[] = ['video', 'image', 'tts', 'music'];

const MAX_MEDIA = 4;

function typeShortLabel(type: JobType): string {
  switch (type) {
    case 'video':
      return 'VIDEO';
    case 'image':
      return 'ẢNH';
    case 'tts':
      return 'GIỌNG';
    case 'music':
      return 'NHẠC';
    default:
      return type.toUpperCase();
  }
}

const HERO_COLLAPSED_PLACEHOLDER = 'Nhập mô tả để tạo ảnh hoặc video…';
const HERO_PROMPT_PLACEHOLDER = 'Mô tả điều bạn muốn tạo…';

function promptPlaceholder(type: JobType): string {
  switch (type) {
    case 'video':
      return 'Mô tả video bạn muốn tạo…';
    case 'image':
      return 'Mô tả ảnh bạn muốn tạo…';
    case 'tts':
      return 'Nhập văn bản cần đọc…';
    case 'music':
      return 'Mô tả phong cách nhạc…';
    default:
      return 'Mô tả nội dung…';
  }
}

function urlMediaKind(url: string): 'image' | 'video' {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url) ? 'video' : 'image';
}

interface MiniDropdownProps {
  icon: React.ReactNode;
  options: ModelOption[];
  value: string;
  onChange: (v: string) => void;
}

function MiniDropdown({ icon, options, value, onChange }: MiniDropdownProps) {
  const [open, setOpen] = useState(false);
  const { triggerRef, panelRef, pos } = useAnchoredDropdown(open, setOpen);
  const current = options.find((o) => o.value === value) ?? options[0];
  const panelStyle = anchoredPanelStyle(pos, 110);

  if (!options.length) return null;

  return (
    <div className="qc-mini" ref={triggerRef}>
      <button
        type="button"
        className="qc-mini-trigger"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        {icon}
        <span>{current?.label ?? value}</span>
        <ChevronDown size={12} />
      </button>
      {open &&
        pos &&
        createPortal(
          <div className="qc-mini-menu qc-dropdown-portal" ref={panelRef} style={panelStyle}>
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                className={o.value === value ? 'active' : ''}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                {o.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

interface QuickModelDropdownProps {
  loading: boolean;
  label: string;
  open: boolean;
  setOpen: (v: boolean) => void;
  options: ModelOption[];
  value: string;
  onChange: (v: string) => void;
}

function QuickModelDropdown({
  loading,
  label,
  open,
  setOpen,
  options,
  value,
  onChange,
}: QuickModelDropdownProps) {
  const { triggerRef, panelRef, pos } = useAnchoredDropdown(open, setOpen);
  const panelStyle = anchoredPanelStyle(pos, 220);

  return (
    <div className="qc-model" ref={triggerRef}>
      <button
        type="button"
        className="qc-model-trigger"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        disabled={loading}
      >
        <Sparkles size={13} />
        <span>{label}</span>
        <ChevronDown size={12} />
      </button>
      {open &&
        options.length > 0 &&
        pos &&
        createPortal(
          <div className="qc-model-menu qc-dropdown-portal" ref={panelRef} style={panelStyle}>
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                className={o.value === value ? 'active' : ''}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                <span>{o.label}</span>
                {(o.description || o.price != null) && (
                  <small>{o.description || o.price}</small>
                )}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

interface HomeQuickCreateBarProps {
  /** `hero` embeds in Home hero; `dock` is the fixed bottom bar (legacy). */
  variant?: 'hero' | 'dock';
}

export default function HomeQuickCreateBar({ variant = 'dock' }: HomeQuickCreateBarProps) {
  const navigate = useNavigate();
  const isHero = variant === 'hero';
  const [type, setType] = useState<JobType>(isHero ? 'image' : 'video');
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [typeCounts, setTypeCounts] = useState<Partial<Record<JobType, number>>>({});
  const [expanded, setExpanded] = useState(false);
  const [models, setModels] = useState<GommoModel[]>([]);
  const [modelSlugSel, setModelSlugSel] = useState('');
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [refs, setRefs] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [result, setResult] = useState<{ url: string; type: JobType } | null>(null);
  const [selections, setSelections] = useState<JobSelections>({});
  /** Khóa submit sau khi VMedia đã nhận job (tránh spam tạo lại). */
  const [providerBusy, setProviderBusy] = useState(false);

  const typeRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const currentModel = useMemo(
    () => models.find((m) => modelSlug(m) === modelSlugSel) ?? null,
    [models, modelSlugSel],
  );
  const schema: ModelSchema | null = useMemo(
    () => (currentModel ? buildQuickSchema(currentModel, type) : null),
    [currentModel, type],
  );
  const unitCost = useMemo(() => {
    if (!currentModel) return 0;
    return (
      resolveModelPrice(
        currentModel,
        selections.mode || '',
        selections.resolution || '',
        selections.duration || '',
      ) || (currentModel.price ?? 0)
    );
  }, [currentModel, selections.mode, selections.resolution, selections.duration]);
  const cost = unitCost * qty;

  useEffect(() => {
    let active = true;
    setLoadingModels(true);
    setError('');
    loadQuickModels(type)
      .then((list) => {
        if (!active) return;
        setModels(list);
        setModelSlugSel(list[0] ? modelSlug(list[0]) : '');
      })
      .catch((err) => active && setError(err instanceof Error ? err.message : String(err)))
      .finally(() => active && setLoadingModels(false));
    return () => {
      active = false;
    };
  }, [type]);

  useEffect(() => {
    if (!canQuickCreate()) return;
    let active = true;
    void Promise.all(
      JOB_TYPES.map(async (jobType) => {
        try {
          const list = await loadQuickModels(jobType);
          return [jobType, list.length] as const;
        } catch {
          return [jobType, 0] as const;
        }
      }),
    ).then((rows) => {
      if (active) setTypeCounts(Object.fromEntries(rows));
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!schema) return;
    setSelections((prev) => mergeSelectionsForSchema(prev, schema));
  }, [schema]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (typeRef.current && !typeRef.current.contains(e.target as Node)) setTypeMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (!isHero || !expanded) return;

    const canCollapse = () => !prompt.trim() && refs.length === 0 && !result;

    const onDoc = (e: MouseEvent) => {
      if (barRef.current?.contains(e.target as Node)) return;
      if (typeMenuOpen || modelMenuOpen) return;
      if (canCollapse()) setExpanded(false);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setTypeMenuOpen(false);
      setModelMenuOpen(false);
      if (canCollapse()) setExpanded(false);
    };

    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [isHero, expanded, prompt, refs.length, result, typeMenuOpen, modelMenuOpen]);

  // Báo cho Quick Chat FAB lùi lên khi dock cố định hiển thị.
  useEffect(() => {
    if (isHero) return;
    document.body.classList.add('qc-dock-active');
    return () => document.body.classList.remove('qc-dock-active');
  }, [isHero]);

  const update = <K extends keyof JobSelections>(key: K, value: JobSelections[K]) =>
    setSelections((s) => ({ ...s, [key]: value }));

  const mediaPickKind = type === 'video' ? 'any' : 'image';

  const ingestMediaUrl = (url: string) => {
    if (refs.length >= MAX_MEDIA) return;
    setError('');
    setRefs((prev) => [...prev, url]);
  };

  const ingestMediaFile = async (file: File) => {
    if (refs.length >= MAX_MEDIA) return;
    setError('');
    try {
      const url =
        type === 'video'
          ? await uploadQuickMedia(file)
          : await uploadQuickImage(file);
      if (!url) return;
      setRefs((prev) => [...prev, url]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const submit = async () => {
    if (submitting || providerBusy) return;
    if (!canQuickCreate()) {
      setError('Bạn cần đăng nhập để tạo nội dung.');
      return;
    }
    if (!currentModel || !schema) {
      setError('Đang tải model, thử lại sau giây lát.');
      return;
    }
    const text = prompt.trim();
    if (!text && refs.length === 0) {
      setError('Nhập mô tả trước khi tạo.');
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const sel = normalizeComponentSelections({
      ...selections,
      prompt: type === 'tts' ? selections.prompt : type === 'music' ? '' : text,
      text: type === 'tts' ? text : selections.text,
      name: type === 'music' ? text.slice(0, 60) || 'Quick track' : selections.name,
      style: type === 'music' ? text || 'instrumental pop' : selections.style,
      instrumental: type === 'music' ? true : selections.instrumental,
      ...(refs.length ? { subjects: refs } : {}),
    });

    setSubmitting(true);
    setError('');
    setInfo('');
    setResult(null);
    setProgress('Đang tạo job…');

    try {
      const url = await quickGenerate({
        type,
        model: currentModel,
        selections: sel,
        onProgress: setProgress,
        signal: abortRef.current.signal,
      });
      setResult({ url, type });
      setProgress('');
      setProviderBusy(false);
      notifyCreditsUpdated();
      if (isHero) setExpanded(true);
    } catch (err) {
      if (isJobAcceptedPendingError(err)) {
        setError('');
        setInfo(err.message);
        setProgress('');
        setProviderBusy(true);
        // Mở khóa sau 45s — đủ để giảm spam; user vẫn xem được info.
        window.setTimeout(() => setProviderBusy(false), 45_000);
      } else {
        setError(err instanceof Error ? err.message : String(err));
        setProgress('');
        if (isHero) setExpanded(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const modelOptions: ModelOption[] = models.map((m) => ({
    value: modelSlug(m),
    label: m.name || modelSlug(m),
    price: m.price,
    description: modelPriceRangeLabel(m) || undefined,
  }));

  const showStoryboard = expanded && !isHero && (type === 'video' || type === 'image');

  const menuCount = (item: QuickMenuItem): number | null => {
    if (item.fixedCount != null) return item.fixedCount;
    if (item.jobType) {
      const n = typeCounts[item.jobType];
      return n != null && n > 0 ? n : null;
    }
    return null;
  };

  const onMenuSelect = (item: QuickMenuItem) => {
    setTypeMenuOpen(false);
    if (item.action === 'open-chat') {
      navigate('/chat');
      return;
    }
    if (item.href) {
      navigate(item.href);
      return;
    }
    if (item.jobType) {
      setType(item.jobType);
      setResult(null);
    }
  };

  const promptPlaceholderText = isHero
    ? expanded
      ? HERO_PROMPT_PLACEHOLDER
      : HERO_COLLAPSED_PLACEHOLDER
    : promptPlaceholder(type);

  const generateDisabled =
    submitting ||
    providerBusy ||
    loadingModels ||
    (!prompt.trim() && refs.length === 0);

  const renderGenerateBtn = () => (
    <button
      type="button"
      className="qc-generate-btn"
      onClick={(e) => {
        e.stopPropagation();
        void submit();
      }}
      disabled={generateDisabled}
    >
      {submitting || providerBusy ? (
        <Loader2 size={16} className="qc-spin" />
      ) : (
        'Tạo'
      )}
    </button>
  );

  const openHeroBar = () => {
    setExpanded(true);
    window.requestAnimationFrame(() => promptRef.current?.focus());
  };

  return (
    <div
      ref={barRef}
      className={`qc-bar${isHero ? ' qc-bar--hero' : ''}${expanded ? ' expanded' : ''}`}
      aria-label="Tạo nhanh ảnh, video, giọng nói"
      onClick={isHero && !expanded ? openHeroBar : undefined}
    >
      <div className="qc-hero-prompt-shell">
        <div className="qc-prompt-row">
          {!isHero && (
            <button
              type="button"
              className="qc-expand-toggle"
              onClick={() => setExpanded((v) => !v)}
              title={expanded ? 'Thu gọn' : 'Mở rộng'}
            >
              {expanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          )}
          {isHero && (
            <span className="qc-prompt-icon" aria-hidden>
              <Sparkles size={18} strokeWidth={1.75} />
            </span>
          )}
          <textarea
            ref={promptRef}
            className="qc-prompt"
            rows={isHero ? (expanded ? 2 : 1) : expanded ? 2 : 1}
            placeholder={promptPlaceholderText}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onFocus={() => {
              if (isHero) openHeroBar();
              else setExpanded(true);
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && (expanded || isHero)) {
                e.preventDefault();
                void submit();
              }
            }}
          />
          {isHero && !expanded && renderGenerateBtn()}
        </div>
      </div>

      <div
        className={`qc-hero-expand${expanded ? ' qc-hero-expand--open' : ''}`}
        aria-hidden={isHero && !expanded}
      >
        {result && !isHero && (
          <div className="qc-result">
            <button type="button" className="qc-result-close" onClick={() => setResult(null)}>
              <X size={14} />
            </button>
            {result.type === 'video' ? (
              <video src={result.url} controls className="qc-result-media" />
            ) : result.type === 'image' ? (
              <img src={result.url} alt="kết quả" className="qc-result-media" />
            ) : (
              <audio src={result.url} controls className="qc-result-audio" />
            )}
            <a href={result.url} target="_blank" rel="noreferrer" className="qc-result-link">
              Mở kết quả
            </a>
          </div>
        )}

        {showStoryboard && (
          <div className="qc-storyboard">
            <div className="qc-sb-group">
              <span className="qc-sb-title">
                ĐA PHƯƠNG TIỆN ({refs.length}/{MAX_MEDIA})
              </span>
              <div className="qc-sb-frames">
                {refs.map((url, i) => (
                  <div key={i} className="qc-sb-frame qc-sb-media">
                    {urlMediaKind(url) === 'video' ? (
                      <video src={url} muted loop playsInline />
                    ) : (
                      <img src={url} alt={`media ${i + 1}`} />
                    )}
                    <button
                      type="button"
                      className="qc-sb-remove"
                      onClick={() => setRefs((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
                {refs.length < MAX_MEDIA && (
                  <ComposerMediaPickButton
                    kind={mediaPickKind}
                    className="qc-sb-frame qc-sb-add"
                    title="Thêm media"
                    onFile={ingestMediaFile}
                    onUrl={ingestMediaUrl}
                  >
                    <Plus size={16} />
                    <span>ADD</span>
                  </ComposerMediaPickButton>
                )}
              </div>
            </div>
          </div>
        )}

        {error && !isHero && <div className="qc-error">{error}</div>}
        {info && !error && !isHero && <div className="qc-info">{info}</div>}

        <div className="qc-toolbar">
        {isHero ? (
          <div className="qc-hero-tabs" role="tablist" aria-label="Loại nội dung">
            <button
              type="button"
              role="tab"
              aria-selected={type === 'image'}
              className={`qc-hero-tab${type === 'image' ? ' active' : ''}`}
              onClick={() => {
                setType('image');
                setResult(null);
              }}
            >
              <ImageIcon size={14} strokeWidth={1.75} aria-hidden />
              <span>Ảnh</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={type === 'video'}
              className={`qc-hero-tab${type === 'video' ? ' active' : ''}`}
              onClick={() => {
                setType('video');
                setResult(null);
              }}
            >
              <Clapperboard size={14} strokeWidth={1.75} aria-hidden />
              <span>Video</span>
            </button>
          </div>
        ) : (
          <div className="qc-type" ref={typeRef}>
            <button
              type="button"
              className="qc-type-trigger"
              onClick={() => setTypeMenuOpen((v) => !v)}
            >
              <span className="qc-dot" /> {typeShortLabel(type)}
              <ChevronUp size={12} />
            </button>
            {typeMenuOpen && (
              <div className="qc-type-menu" role="menu">
                {QUICK_MENU.map((item) => {
                  const Icon = item.icon;
                  const count = menuCount(item);
                  const active = item.jobType === type;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      className={`qc-type-item${active ? ' active' : ''}`}
                      onClick={() => onMenuSelect(item)}
                    >
                      <span className="qc-type-accent" aria-hidden />
                      <Icon size={16} className="qc-type-icon" />
                      <span className="qc-type-label">{item.label}</span>
                      {count != null && <span className="qc-type-count">{count}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <QuickModelDropdown
          loading={loadingModels}
          label={
            loadingModels
              ? 'Đang tải…'
              : currentModel?.name || modelSlugSel || 'Chọn model'
          }
          open={modelMenuOpen}
          setOpen={setModelMenuOpen}
          options={modelOptions}
          value={modelSlugSel}
          onChange={setModelSlugSel}
        />

        {schema?.fields.ratio && (
          <MiniDropdown
            icon={<Proportions size={13} />}
            options={schema.options.ratios}
            value={selections.ratio || ''}
            onChange={(v) => update('ratio', v)}
          />
        )}
        {schema?.fields.resolution && (
          <MiniDropdown
            icon={<Monitor size={13} />}
            options={schema.options.resolutions}
            value={selections.resolution || ''}
            onChange={(v) => update('resolution', v)}
          />
        )}
        {schema?.fields.duration && (
          <MiniDropdown
            icon={<Clock size={13} />}
            options={schema.options.durations}
            value={selections.duration || ''}
            onChange={(v) => update('duration', v)}
          />
        )}
        {schema?.fields.mode && (
          <MiniDropdown
            icon={<SlidersHorizontal size={13} />}
            options={schema.options.modes}
            value={selections.mode || ''}
            onChange={(v) => update('mode', v)}
          />
        )}

        <div className="qc-qty">
          <span>Qty</span>
          <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))}>
            −
          </button>
          <strong>{qty}</strong>
          <button type="button" onClick={() => setQty((q) => Math.min(4, q + 1))}>
            +
          </button>
        </div>

        <div className="qc-toolbar-right">
          {cost > 0 && <span className="qc-cost">{cost.toLocaleString('vi-VN')}</span>}
          {progress && <span className="qc-progress">{progress}</span>}
          {isHero ? (
            renderGenerateBtn()
          ) : (
            <button
              type="button"
              className="qc-send"
              onClick={() => void submit()}
              disabled={submitting || providerBusy || loadingModels}
              title="Tạo"
            >
              {submitting || providerBusy ? (
                <Loader2 size={16} className="qc-spin" />
              ) : (
                <SendHorizontal size={16} />
              )}
            </button>
          )}
        </div>
      </div>
      </div>

      {isHero && (result || error || info) && (
        <div className="qc-hero-feedback">
          {result && (
            <div className="qc-result">
              <button type="button" className="qc-result-close" onClick={() => setResult(null)}>
                <X size={14} />
              </button>
              {result.type === 'video' ? (
                <video src={result.url} controls className="qc-result-media" />
              ) : result.type === 'image' ? (
                <img src={result.url} alt="kết quả" className="qc-result-media" />
              ) : (
                <audio src={result.url} controls className="qc-result-audio" />
              )}
              <a href={result.url} target="_blank" rel="noreferrer" className="qc-result-link">
                Mở kết quả
              </a>
            </div>
          )}
          {error && <div className="qc-error">{error}</div>}
          {info && !error && <div className="qc-info">{info}</div>}
        </div>
      )}
    </div>
  );
}
