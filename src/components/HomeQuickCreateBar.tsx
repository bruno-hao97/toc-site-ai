import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Clapperboard,
  Clock,
  Image as ImageIcon,
  Loader2,
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
import type { GommoModel, JobType } from '../services/api';
import type { JobSelections, ModelOption, ModelSchema } from '../services/modelSchema';
import { defaultSelections, modelSlug } from '../services/modelSchema';
import {
  buildQuickSchema,
  canQuickCreate,
  loadQuickModels,
  quickGenerate,
  uploadQuickImage,
} from '../services/quickCreate';
import { notifyCreditsUpdated } from '../services/authStore';

interface TypeDef {
  type: JobType;
  label: string;
  icon: typeof ImageIcon;
}

const TYPES: TypeDef[] = [
  { type: 'video', label: 'Tạo video', icon: Clapperboard },
  { type: 'image', label: 'Tạo ảnh', icon: ImageIcon },
  { type: 'tts', label: 'Tạo giọng đọc', icon: Volume2 },
  { type: 'music', label: 'Tạo nhạc', icon: Music },
];

const MAX_MEDIA = 4;

function typeLabel(type: JobType): string {
  return TYPES.find((t) => t.type === type)?.label ?? type;
}

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

interface MiniDropdownProps {
  icon: React.ReactNode;
  options: ModelOption[];
  value: string;
  onChange: (v: string) => void;
}

function MiniDropdown({ icon, options, value, onChange }: MiniDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!options.length) return null;

  return (
    <div className="qc-mini" ref={ref}>
      <button type="button" className="qc-mini-trigger" onClick={() => setOpen((v) => !v)}>
        {icon}
        <span>{current?.label ?? value}</span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="qc-mini-menu">
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
        </div>
      )}
    </div>
  );
}

export default function HomeQuickCreateBar() {
  const [type, setType] = useState<JobType>('video');
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
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
  const [result, setResult] = useState<{ url: string; type: JobType } | null>(null);
  const [selections, setSelections] = useState<JobSelections>({});

  const typeRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const currentModel = useMemo(
    () => models.find((m) => modelSlug(m) === modelSlugSel) ?? null,
    [models, modelSlugSel],
  );
  const schema: ModelSchema | null = useMemo(
    () => (currentModel ? buildQuickSchema(currentModel, type) : null),
    [currentModel, type],
  );
  const cost = (currentModel?.price ?? 0) * qty;

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
    if (!schema) return;
    const defs = defaultSelections(schema);
    setSelections((prev) => ({
      ...prev,
      ratio: prev.ratio || defs.ratio,
      mode: prev.mode || defs.mode,
      resolution: prev.resolution || defs.resolution,
      duration: prev.duration || defs.duration,
    }));
  }, [schema]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (typeRef.current && !typeRef.current.contains(e.target as Node)) setTypeMenuOpen(false);
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) setModelMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // Báo cho Quick Chat FAB lùi lên khi dock hiển thị.
  useEffect(() => {
    document.body.classList.add('qc-dock-active');
    return () => document.body.classList.remove('qc-dock-active');
  }, []);

  const update = <K extends keyof JobSelections>(key: K, value: JobSelections[K]) =>
    setSelections((s) => ({ ...s, [key]: value }));

  const onPickMedia = async (file: File | null) => {
    if (!file || refs.length >= MAX_MEDIA) return;
    setError('');
    try {
      const url = await uploadQuickImage(file);
      if (url) setRefs((prev) => [...prev, url]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const submit = async () => {
    if (submitting) return;
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

    const sel: JobSelections = {
      ...selections,
      prompt: type === 'tts' ? selections.prompt : text,
      text: type === 'tts' ? text : selections.text,
      name: type === 'music' ? text.slice(0, 60) || 'Quick track' : selections.name,
      references: refs.length ? refs : undefined,
      images: refs.length ? refs : undefined,
    };

    setSubmitting(true);
    setError('');
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
      notifyCreditsUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setProgress('');
    } finally {
      setSubmitting(false);
    }
  };

  const modelOptions: ModelOption[] = models.map((m) => ({
    value: modelSlug(m),
    label: m.name || modelSlug(m),
    price: m.price,
  }));

  const showStoryboard = expanded && (type === 'video' || type === 'image');

  return (
    <div className={`qc-bar${expanded ? ' expanded' : ''}`}>
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

      {showStoryboard && (
        <div className="qc-storyboard">
          <div className="qc-sb-group">
            <span className="qc-sb-title">KHUNG HÌNH</span>
            <div className="qc-sb-frames">
              <button type="button" className="qc-sb-frame qc-sb-start">
                <Plus size={16} />
                <span>START</span>
              </button>
            </div>
          </div>
          <div className="qc-sb-group">
            <span className="qc-sb-title">
              ĐA PHƯƠNG TIỆN ({refs.length}/{MAX_MEDIA})
            </span>
            <div className="qc-sb-frames">
              {refs.map((url, i) => (
                <div key={i} className="qc-sb-frame qc-sb-media">
                  <img src={url} alt={`media ${i + 1}`} />
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
                <button
                  type="button"
                  className="qc-sb-frame qc-sb-add"
                  onClick={() => fileRef.current?.click()}
                >
                  <Plus size={16} />
                  <span>ADD</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="qc-prompt-row">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            void onPickMedia(e.target.files?.[0] ?? null);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          className="qc-expand-toggle"
          onClick={() => setExpanded((v) => !v)}
          title={expanded ? 'Thu gọn' : 'Mở rộng'}
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
        <textarea
          className="qc-prompt"
          rows={expanded ? 2 : 1}
          placeholder={promptPlaceholder(type)}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onFocus={() => setExpanded(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
        />
      </div>

      {error && <div className="qc-error">{error}</div>}

      <div className="qc-toolbar">
        <div className="qc-type" ref={typeRef}>
          <button
            type="button"
            className="qc-type-trigger"
            onClick={() => setTypeMenuOpen((v) => !v)}
          >
            <span className="qc-dot" /> {typeLabel(type).replace('Tạo ', '').toUpperCase()}
            <ChevronUp size={12} />
          </button>
          {typeMenuOpen && (
            <div className="qc-type-menu">
              {TYPES.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.type}
                    type="button"
                    className={t.type === type ? 'active' : ''}
                    onClick={() => {
                      setType(t.type);
                      setTypeMenuOpen(false);
                      setResult(null);
                    }}
                  >
                    <Icon size={15} /> {t.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="qc-model" ref={modelRef}>
          <button
            type="button"
            className="qc-model-trigger"
            onClick={() => setModelMenuOpen((v) => !v)}
            disabled={loadingModels}
          >
            <Sparkles size={13} />
            <span>
              {loadingModels
                ? 'Đang tải…'
                : currentModel?.name || modelSlugSel || 'Chọn model'}
            </span>
            <ChevronDown size={12} />
          </button>
          {modelMenuOpen && modelOptions.length > 0 && (
            <div className="qc-model-menu">
              {modelOptions.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={o.value === modelSlugSel ? 'active' : ''}
                  onClick={() => {
                    setModelSlugSel(o.value);
                    setModelMenuOpen(false);
                  }}
                >
                  <span>{o.label}</span>
                  {o.price != null && <small>{o.price}</small>}
                </button>
              ))}
            </div>
          )}
        </div>

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
          <button
            type="button"
            className="qc-send"
            onClick={() => void submit()}
            disabled={submitting || loadingModels}
            title="Tạo"
          >
            {submitting ? <Loader2 size={16} className="qc-spin" /> : <SendHorizontal size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
