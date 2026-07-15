import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  Clapperboard,
  Film,
  Clipboard,
  Clock,
  Download,
  Image as ImageIcon,
  Maximize2,
  Monitor,
  PersonStanding,
  Plus,
  Proportions,
  Video,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Wand2,
  Bot,
} from 'lucide-react';
import {
  GommoApiError,
  type GommoModel,
  type JobType,
} from '../services/api';
import StudioGallery, { type SessionItem } from '../components/StudioGallery';
import ComposerHistory from '../components/ComposerHistory';
import ComposerLibrary from '../components/ComposerLibrary';
import ComposerLibraryItem from '../components/ComposerLibraryItem';
import ComposerLibraryPreviewModal, {
  type ComposerPreviewHandlers,
} from '../components/ComposerLibraryPreviewModal';
import ComposerSelectCircle from '../components/ComposerSelectCircle';
import UrlField from '../components/UrlField';
import {
  defaultSelectionsForType,
  historyPromptFromSelections,
  jobTypeToHistoryType,
  REUSABLE_JOB_TYPES,
  STUDIO_JOB_TYPES,
} from '../constants/studioTypes';
import {
  getCreditsAi,
  getGommoClient,
  loadAuth,
  notifyCreditsUpdated,
  refreshSession,
} from '../services/authStore';

import {
  addLocalJob,
  listLocalJobs,
  updateLocalJob,
  type LocalJob,
} from '../services/jobHistoryStore';
import {
  analyzeModel,
  buildJobPayload,
  defaultSelections,
  modelSlug,
  parseModelsList,
  type JobSelections,
  type ModelOption,
  type ModelSchema,
} from '../services/modelSchema';
import { createJobAndPoll, type PollProgress } from '../services/polling';
import {
  addHistoryEntry,
  isMediaUrl,
  listHistory,
  removeHistoryEntry,
  type HistoryEntry,
} from '../services/historyStore';
import { deleteFeedPost, feedMediaUrl, feedThumb } from '../services/feedApi';
import type { FeedItem } from '../services/feedApi';
import {
  historyComposerMediaKind,
  historyEntriesToFeedItems,
  historyEntryToFeedItem,
  historyJobUsesClibLayout,
  isClibHistoryEntry,
} from '../utils/historyFeedAdapter';
import { feedItemToHistoryEntry } from '../utils/feedItemReuse';
import { useHistoryUpdated } from '../hooks/useHistoryUpdated';
import { extractPollSnapshot } from '../services/mediaGenerationStatus';
import {
  canUseComposerPromptAi,
  enhancePromptWithAi,
  generateShotsWithAi,
  normalizePromptWithAi,
} from '../services/composerPromptAi';
import {
  getMultiShotConfig,
  newShot,
  type ComposerShot,
} from '../services/composerShots';
import {
  getReferenceLimits,
  getUploadRules,
  mapUploadTarget,
  probeVideoDuration,
  validateMediaFile,
} from '../services/modelUploadRules';
import ComposerVideoAgentChat from '../components/ComposerVideoAgentChat';
import { useLocale } from '../i18n';
import type { TranslationKey } from '../i18n';
import type { TranslateFn } from '../i18n/LanguageProvider';
import ComposerMediaSlot from '../components/ComposerMediaSlot';
import ComposerMediaPickButton from '../components/ComposerMediaPickButton';
import { mediaKindFromUrl, validateMediaUrl } from '../services/mediaUrlValidation';
import {
  computeMotionPriceQuote,
  getMotionBilledSeconds,
  getMotionPromotionPercent,
  motionModelPriceLabel,
  motionRateLabel,
  probeVideoDurationFromUrl,
  resolveMotionRatePerSecond,
} from '../services/motionPricing';

interface PendingJob {
  id: string;
  prompt: string;
  status: 'processing' | 'failed';
  progress?: number;
}

type ComposerMode = 'single' | 'multi' | 'auto' | 'ai';

function dateGroupLabel(iso: string, t: TranslateFn): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return t('date.today');
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return t('date.yesterday');
  return t('date.monthYear', { month: d.getMonth() + 1, year: d.getFullYear() });
}

// Map server (field upstream) -> tên nhà cung cấp + phụ đề hiển thị, giống 79AI.
const SERVER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  grokai: 'Grok AI',
  google_veo: 'Google',
  midjourneyai: 'Midjourney AI',
  seedream_ai: 'Seedream',
  klingai: 'Kling AI',
  autoai: 'Auto AI',
  alibabaai: 'Alibaba AI',
  dreamina_ai: 'Dreamina',
};

const SERVER_SUBTITLES: Record<string, string> = {
  OpenAI: 'Image generation',
  'Grok AI': 'Professional AI generation',
  Google: 'Precision Visuals with AI',
  'Midjourney AI': 'Professional AI generation',
  Seedream: 'Professional AI generation',
  'Kling AI': 'Professional AI generation',
  'Auto AI': 'Professional AI generation',
  'Alibaba AI': 'Professional AI generation',
  Dreamina: 'Professional AI generation',
};

// Thứ tự hiển thị nhà cung cấp (giống 79AI). Provider ngoài danh sách xếp cuối.
const PROVIDER_ORDER = [
  'OpenAI',
  'Grok AI',
  'Google',
  'Midjourney AI',
  'Seedream',
  'Kling AI',
  'Auto AI',
  'Alibaba AI',
  'Dreamina',
];

// Nhóm model theo nhà cung cấp. Ưu tiên field `server` từ API; nếu không có thì
// fallback các field group/company/... rồi mới đoán theo tên model.
function modelProvider(m: GommoModel): string {
  const server = (m.server || '').trim().toLowerCase();
  if (server && SERVER_LABELS[server]) return SERVER_LABELS[server];

  const raw = m as unknown as Record<string, unknown>;
  for (const key of ['group', 'company', 'provider', 'brand', 'vendor']) {
    const v = raw[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  const n = (m.name || modelSlug(m)).toLowerCase();
  if (/\bgpt\b|dall-?e|openai|sora/.test(n)) return 'OpenAI';
  if (/gemini|nano\s*banana|imagen|veo|google/.test(n)) return 'Google';
  if (/grok|xai/.test(n)) return 'Grok AI';
  if (/kling|colors/.test(n)) return 'Kling AI';
  if (/seedream|seedance/.test(n)) return 'Seedream';
  if (/dreamina|capcut/.test(n)) return 'Dreamina';
  if (/qwen|wan|alibaba|tongyi|z-?image/.test(n)) return 'Alibaba AI';
  if (/midjourney|\bmj\b/.test(n)) return 'Midjourney AI';
  if (/upscale|auto\s*ai/.test(n)) return 'Auto AI';
  if (/flux|black\s*forest/.test(n)) return 'Black Forest Labs';
  if (/runway|gen-?\d/.test(n)) return 'Runway';
  if (/luma|dream\s*machine/.test(n)) return 'Luma';
  if (/stable|sdxl|stability/.test(n)) return 'Stability AI';
  if (/minimax|hailuo/.test(n)) return 'MiniMax';
  if (/elevenlabs|eleven\s*labs/.test(n)) return 'ElevenLabs';
  if (/suno/.test(n)) return 'Suno';
  return 'Khác';
}

function providerSubtitle(provider: string): string {
  return SERVER_SUBTITLES[provider] ?? 'Professional AI generation';
}

function formatPrice(price: number): string {
  return price.toLocaleString('vi-VN');
}

// Khoảng giá min–max của model: ưu tiên mảng prices[] (theo mode/resolution),
// fallback về price gốc. Trả về chuỗi "min-max" hoặc "x" nếu chỉ 1 mức.
function modelPriceLabel(m: GommoModel): string {
  const values: number[] = [];
  if (Array.isArray(m.prices)) {
    for (const p of m.prices) {
      if (typeof p?.price === 'number' && p.price > 0) values.push(p.price);
    }
  }
  if (values.length === 0 && typeof m.price === 'number') values.push(m.price);
  if (values.length === 0) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? formatPrice(min) : `${formatPrice(min)}-${formatPrice(max)}`;
}

// Giá thực tế theo tổ hợp mode + resolution đang chọn. Xử lý mọi dạng prices[]:
// có cả mode+resolution, chỉ resolution (Kling), hoặc chỉ mode (Midjourney 7.0).
function resolveModelPrice(
  model: GommoModel | null,
  mode: string,
  resolution: string,
): number {
  if (!model) return 0;
  const prices = model.prices;
  if (!Array.isArray(prices) || prices.length === 0) return model.price ?? 0;
  const eq = (a?: string, b?: string) => (a ?? '').toLowerCase() === (b ?? '').toLowerCase();

  const hit =
    prices.find((p) => eq(p.mode, mode) && eq(p.resolution, resolution)) ??
    prices.find((p) => p.mode == null && eq(p.resolution, resolution)) ??
    prices.find((p) => p.resolution == null && eq(p.mode, mode)) ??
    prices.find((p) => eq(p.resolution, resolution)) ??
    prices.find((p) => eq(p.mode, mode));
  return hit?.price ?? model.price ?? prices[0]?.price ?? 0;
}

function isModelMaintenance(m: GommoModel): boolean {
  const s = String(m.status || 'ON').toUpperCase();
  return s !== 'ON' && s !== 'ACTIVE';
}

// Model dạng "Motion" (Kling Motion…): nhận ảnh nhân vật + video tham chiếu.
function isMotionModel(m: GommoModel): boolean {
  return Boolean((m as { withMotion?: boolean }).withMotion);
}

function isEditModel(m: GommoModel): boolean {
  return Boolean((m as { withEdit?: boolean }).withEdit);
}

// Chuẩn hóa 1 prompt: bỏ khoảng trắng thừa, gộp nhiều dòng/space thành 1 space.
function normalizeOnePrompt(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

// Mở rộng mô tả ngắn thành prompt chi tiết (chế độ AI – placeholder tới khi có API riêng).
function expandBriefToPrompt(brief: string, type: JobType): string {
  const b = brief.trim();
  if (!b) return '';
  if (type === 'video') {
    return `${b}. Cinematic shot, smooth camera motion, professional lighting, high detail, film quality.`;
  }
  if (type === 'music') return b;
  return `${b}. Highly detailed, professional quality, sharp focus, vibrant colors, masterpiece.`;
}

// Đoán loại media từ đuôi URL để render thumbnail tham chiếu cho đúng.
function urlMediaKind(url: string): 'image' | 'video' | 'audio' {
  const u = url.toLowerCase();
  if (/\.(mp4|webm|mov|m4v)(\?|$)/.test(u)) return 'video';
  if (/\.(mp3|wav|ogg|m4a|aac)(\?|$)/.test(u)) return 'audio';
  return 'image';
}

function mediaKindFromFile(file: File): 'image' | 'video' {
  if (file.type.startsWith('video/')) return 'video';
  return 'image';
}

// Lấy mảng cảnh báo (notices.select) để hiển thị ở chế độ Motion.
function modelSelectNotices(m: GommoModel | null): string[] {
  if (!m) return [];
  const n = (m as { notices?: unknown }).notices;
  if (!n || typeof n !== 'object') return [];
  const sel = (n as { select?: unknown }).select;
  if (Array.isArray(sel)) return sel.filter((x): x is string => typeof x === 'string');
  if (typeof sel === 'string') return [sel];
  return [];
}

// NEW = model nằm trong đợt phát hành mới nhất (created_time trong vòng 30 ngày
// so với model mới nhất của danh sách). Robust với clock tuyệt đối.
function buildNewModelChecker(models: GommoModel[]): (m: GommoModel) => boolean {
  let newest = 0;
  for (const m of models) {
    if (typeof m.created_time === 'number' && m.created_time > newest) newest = m.created_time;
  }
  const threshold = newest - 30 * 24 * 60 * 60;
  return (m: GommoModel) =>
    newest > 0 && typeof m.created_time === 'number' && m.created_time >= threshold;
}

function modelOnSale(m: GommoModel): boolean {
  const raw = m as unknown as Record<string, unknown>;
  for (const key of ['sale', 'on_sale', 'discount', 'is_sale']) {
    const v = raw[key];
    if (typeof v === 'boolean' && v) return true;
    if (typeof v === 'number' && v > 0) return true;
  }
  return false;
}

const RECENT_MODELS_KEY = 'studio:recent-models';

function loadRecentModelSlugs(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_MODELS_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

function pushRecentModelSlug(slug: string): void {
  if (!slug) return;
  try {
    const list = [slug, ...loadRecentModelSlugs().filter((s) => s !== slug)].slice(0, 6);
    localStorage.setItem(RECENT_MODELS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

interface AnchorPos {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: 'down' | 'up';
}

// Định vị panel theo trigger (fixed) + đóng khi click ngoài/Escape + reposition khi
// cuộn/resize. Dùng cho dropdown render qua portal để không bị container overflow cắt.
function useAnchoredDropdown(open: boolean, setOpen: (v: boolean) => void) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<AnchorPos | null>(null);

  const updatePos = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 4;
    const spaceBelow = window.innerHeight - r.bottom - 8;
    const spaceAbove = r.top - 8;
    const placeUp = spaceBelow < 240 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(200, Math.min(560, (placeUp ? spaceAbove : spaceBelow) - gap));
    setPos({
      left: r.left,
      width: r.width,
      top: placeUp ? r.top - gap : r.bottom + gap,
      maxHeight,
      placement: placeUp ? 'up' : 'down',
    });
  }, []);

  useEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    updatePos();
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [open, setOpen, updatePos]);

  return { triggerRef, panelRef, pos };
}

function anchoredPanelStyle(pos: AnchorPos | null): CSSProperties | undefined {
  if (!pos) return undefined;
  // Panel có thể rộng hơn trigger do min-width (option 180 / model 320). Clamp mép
  // trái để không tràn khỏi viewport bên phải.
  const effectiveWidth = Math.max(pos.width, 320);
  const left = Math.max(8, Math.min(pos.left, window.innerWidth - effectiveWidth - 8));
  return {
    position: 'fixed',
    left,
    width: pos.width,
    top: pos.top,
    maxHeight: pos.maxHeight,
    ...(pos.placement === 'up' ? { transform: 'translateY(-100%)' } : {}),
  };
}

function ModelPicker({
  models,
  value,
  onChange,
  loading,
  multi = false,
  multiValues = [],
  onMultiChange,
  motionPricing = false,
  selectionMode = '',
  selectionResolution = '',
}: {
  models: GommoModel[];
  value: string;
  onChange: (slug: string) => void;
  loading: boolean;
  multi?: boolean;
  multiValues?: string[];
  onMultiChange?: (slugs: string[]) => void;
  motionPricing?: boolean;
  selectionMode?: string;
  selectionResolution?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'new' | 'sale'>('new');
  const [recent, setRecent] = useState<string[]>([]);
  const { triggerRef, panelRef, pos } = useAnchoredDropdown(open, setOpen);

  const current = models.find((m) => modelSlug(m) === value) ?? null;

  useEffect(() => {
    if (open) setRecent(loadRecentModelSlugs());
  }, [open]);

  const isNew = useMemo(() => buildNewModelChecker(models), [models]);
  const hasSale = useMemo(() => models.some(modelOnSale), [models]);

  const select = (slug: string) => {
    pushRecentModelSlug(slug);
    if (multi && onMultiChange) {
      const has = multiValues.includes(slug);
      onMultiChange(has ? multiValues.filter((s) => s !== slug) : [...multiValues, slug]);
      onChange(slug);
      return;
    }
    onChange(slug);
    setOpen(false);
    setSearch('');
  };

  const renderItem = (m: GommoModel) => {
    const slug = modelSlug(m);
    const active = multi ? multiValues.includes(slug) : slug === value;
    const priceLabel = motionPricing ? motionModelPriceLabel(m) : modelPriceLabel(m);
    const maint = isModelMaintenance(m);
    return (
      <button
        key={slug}
        type="button"
        className={`model-picker-item ${active ? 'active' : ''}`}
        onClick={() => select(slug)}
      >
        <span className="model-picker-item-main">
          <span className="model-picker-item-head">
            <span className="model-picker-item-name">{m.name || slug}</span>
            {isNew(m) && <span className="model-picker-badge new">NEW</span>}
            {maint && <span className="model-picker-badge maint">MAINT</span>}
          </span>
          {m.description && (
            <span className="model-picker-item-desc">{m.description}</span>
          )}
        </span>
        <span className="model-picker-item-meta">
          {priceLabel && <span className="model-picker-item-price">{priceLabel}</span>}
          {active && <Check size={14} className="model-picker-check" />}
        </span>
      </button>
    );
  };

  // Lọc theo search.
  const q = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      models.filter((m) => {
        if (!q) return true;
        return `${m.name ?? ''} ${modelSlug(m)} ${m.description ?? ''}`
          .toLowerCase()
          .includes(q);
      }),
    [models, q],
  );

  // Nguồn theo tab (chỉ áp dụng khi không search).
  const tabModels = useMemo(() => {
    if (q || tab === 'new') return filtered;
    return filtered.filter(modelOnSale);
  }, [filtered, tab, q]);

  // Nhóm theo nhà cung cấp + sắp xếp theo PROVIDER_ORDER.
  const grouped = useMemo(() => {
    const map = new Map<string, GommoModel[]>();
    for (const m of tabModels) {
      const g = modelProvider(m);
      const list = map.get(g);
      if (list) list.push(m);
      else map.set(g, [m]);
    }
    return [...map.entries()].sort((a, b) => {
      const ia = PROVIDER_ORDER.indexOf(a[0]);
      const ib = PROVIDER_ORDER.indexOf(b[0]);
      const ra = ia === -1 ? PROVIDER_ORDER.length : ia;
      const rb = ib === -1 ? PROVIDER_ORDER.length : ib;
      if (ra !== rb) return ra - rb;
      return a[0].localeCompare(b[0]);
    });
  }, [tabModels]);

  const recentModels = useMemo(() => {
    if (q || tab !== 'new') return [];
    const bySlug = new Map(models.map((m) => [modelSlug(m), m] as const));
    return recent
      .map((s) => bySlug.get(s))
      .filter((m): m is GommoModel => Boolean(m))
      .slice(0, 4);
  }, [recent, models, q, tab]);

  const totalShown = tabModels.length;
  const panelStyle = anchoredPanelStyle(pos);
  const triggerPrice = current
    ? motionPricing
      ? motionRateLabel(current, selectionMode, selectionResolution) ||
        motionModelPriceLabel(current)
      : modelPriceLabel(current)
    : '';
  const multiLabel = useMemo(() => {
    if (!multi || multiValues.length === 0) return '';
    if (multiValues.length === 1) {
      const m = models.find((x) => modelSlug(x) === multiValues[0]);
      return m?.name || multiValues[0];
    }
    return `${multiValues.length} model đã chọn`;
  }, [multi, multiValues, models]);

  return (
    <div className="model-picker" ref={triggerRef}>
      <button
        type="button"
        className={`model-picker-trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        disabled={loading}
      >
        <span className="model-picker-current">
          {loading
            ? 'Đang tải…'
            : multi
              ? multiLabel || '— Chọn model —'
              : current
                ? current.name || modelSlug(current)
                : '— Chọn model —'}
        </span>
        {!multi && triggerPrice && <span className="model-picker-price">{triggerPrice}</span>}
        {multi && multiValues.length > 1 && (
          <span className="model-picker-price">{multiValues.length}×</span>
        )}
        <ChevronDown size={14} className={`model-picker-caret ${open ? 'open' : ''}`} />
      </button>

      {open &&
        pos &&
        createPortal(
          <div className="model-picker-panel" ref={panelRef} style={panelStyle}>
            <div className="model-picker-search">
              <Search size={14} />
              <input
                autoFocus
                type="text"
                placeholder="Tìm kiếm…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {!q && hasSale && (
              <div className="model-picker-tabs">
                <button
                  type="button"
                  className={`model-picker-tab ${tab === 'new' ? 'active' : ''}`}
                  onClick={() => setTab('new')}
                >
                  Mới
                </button>
                <button
                  type="button"
                  className={`model-picker-tab ${tab === 'sale' ? 'active' : ''}`}
                  onClick={() => setTab('sale')}
                >
                  Sale
                </button>
              </div>
            )}

            <div className="model-picker-list">
              {totalShown === 0 && (
                <div className="model-picker-empty">Không có model phù hợp</div>
              )}

              {recentModels.length > 0 && (
                <div className="model-picker-group">
                  <div className="model-picker-group-head">Gần đây</div>
                  {recentModels.map(renderItem)}
                </div>
              )}

              {grouped.map(([provider, list]) => (
                <div key={provider} className="model-picker-group">
                  <div className="model-picker-group-head model-picker-provider-head">
                    <span className="model-picker-provider-name">{provider}</span>
                    <span className="model-picker-provider-sub">
                      {providerSubtitle(provider)}
                    </span>
                  </div>
                  {list.map(renderItem)}
                </div>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function OptionDropdown({
  icon,
  options,
  value,
  onChange,
}: {
  icon: ReactNode;
  options: ModelOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { triggerRef, panelRef, pos } = useAnchoredDropdown(open, setOpen);

  const current = options.find((o) => o.value === value) ?? null;
  const panelStyle = anchoredPanelStyle(pos);

  return (
    <div className="opt-dropdown" ref={triggerRef}>
      <button
        type="button"
        className={`opt-dropdown-trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="opt-dropdown-icon">{icon}</span>
        <span className="opt-dropdown-current">{current?.label ?? '—'}</span>
        <ChevronDown size={13} className={`opt-dropdown-caret ${open ? 'open' : ''}`} />
      </button>

      {open &&
        pos &&
        createPortal(
          <div className="opt-dropdown-panel" ref={panelRef} style={panelStyle}>
            <div className="opt-dropdown-list">
              {options.map((o) => {
                const active = o.value === value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    className={`opt-dropdown-item ${active ? 'active' : ''}`}
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                  >
                    <span className="opt-dropdown-item-name">{o.label}</span>
                    {active && <Check size={13} className="opt-dropdown-check" />}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

export default function StudioPage({
  initialType = 'image',
  lockType = false,
  layout = 'classic',
}: {
  initialType?: JobType;
  lockType?: boolean;
  layout?: 'classic' | 'composer';
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLocale();
  const [jobType, setJobType] = useState<JobType>(initialType);
  const [models, setModels] = useState<GommoModel[]>([]);
  const [selectedSlug, setSelectedSlug] = useState('');
  const [schema, setSchema] = useState<ModelSchema | null>(null);
  const [selections, setSelections] = useState<JobSelections>(defaultSelectionsForType(initialType));
  const [loadingModels, setLoadingModels] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [recentJobs, setRecentJobs] = useState<LocalJob[]>([]);
  const [sessionItems, setSessionItems] = useState<SessionItem[]>([]);
  const [credits, setCredits] = useState(getCreditsAi());
  const [qty, setQty] = useState(1);
  const [composerMode, setComposerMode] = useState<ComposerMode>(() => {
    const saved = localStorage.getItem('studioComposerMode');
    return saved === 'multi' || saved === 'auto' || saved === 'ai' ? saved : 'single';
  });
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [aiBrief, setAiBrief] = useState('');
  // /video có 2 chế độ cấp cao: tạo video thường ('create') và Motion ('motion').
  const [videoMode, setVideoMode] = useState<'create' | 'motion' | 'edit'>('create');
  const [motionVideoUrl, setMotionVideoUrl] = useState('');
  const [motionVideoDuration, setMotionVideoDuration] = useState(0);
  const [motionDurationLoading, setMotionDurationLoading] = useState(false);
  const [editVideoUrl, setEditVideoUrl] = useState('');
  const [multiShotEnabled, setMultiShotEnabled] = useState(false);
  // Chế độ nhập liệu: 'frame' (Ảnh đầu/cuối) hoặc 'component' (Thêm media – tham chiếu).
  const [inputMode, setInputMode] = useState<'frame' | 'component'>(() =>
    localStorage.getItem('studioInputMode') === 'component' ? 'component' : 'frame',
  );
  const [normalizePrompt, setNormalizePrompt] = useState(
    () => localStorage.getItem('studioNormalize') === '1',
  );
  const [enhancingPrompt, setEnhancingPrompt] = useState(false);
  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [componentDragOver, setComponentDragOver] = useState(false);
  const [multiPrompt, setMultiPrompt] = useState(false);
  const [promptSeparator, setPromptSeparator] = useState('=====');
  const [perPromptRef, setPerPromptRef] = useState(false);
  const [refSelectMode, setRefSelectMode] = useState<'fixed' | 'sequential' | 'random'>('sequential');
  const [concurrencyLimit, setConcurrencyLimit] = useState(2);
  const [multiRefs, setMultiRefs] = useState<string[]>([]);
  const [pendingJobs, setPendingJobs] = useState<PendingJob[]>([]);
  const [zoom, setZoom] = useState(200);
  const [mainTab, setMainTab] = useState<'current' | 'history' | 'folder'>('current');
  const [libraryCount, setLibraryCount] = useState(0);
  const [historyCount, setHistoryCount] = useState(0);
  const [libraryVisibleIds, setLibraryVisibleIds] = useState<string[]>([]);
  const [historyVisibleIds, setHistoryVisibleIds] = useState<string[]>([]);
  const [libraryUrlMap, setLibraryUrlMap] = useState<Record<string, string>>({});
  const [historyUrlMap, setHistoryUrlMap] = useState<Record<string, string>>({});
  const [historyTick, setHistoryTick] = useState(0);
  useHistoryUpdated(() => setHistoryTick((n) => n + 1));
  const abortRef = useRef<AbortController | null>(null);
  const sessionStartRef = useRef(Date.now());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState<number | null>(null);
  const [currentDeletingId, setCurrentDeletingId] = useState('');
  // Bề rộng sidebar (kéo chỉnh được), nhớ qua localStorage.
  const composerRef = useRef<HTMLDivElement | null>(null);
  const [sideWidth, setSideWidth] = useState(() => {
    const saved = Number(localStorage.getItem('studioSideWidth'));
    return saved >= 320 && saved <= 640 ? saved : 380;
  });
  const resizingRef = useRef(false);
  const sideWidthRef = useRef(sideWidth);

  const client = useMemo(() => (loadAuth() ? getGommoClient() : null), []);
  const auth = loadAuth();
  // Chỉ /video mới có chế độ Motion; tab chỉ hiện khi list có ít nhất 1 model motion.
  const hasMotionModels = useMemo(
    () => jobType === 'video' && models.some(isMotionModel),
    [jobType, models],
  );
  const hasEditModels = useMemo(
    () => jobType === 'video' && models.some(isEditModel),
    [jobType, models],
  );
  const isMotionView = jobType === 'video' && videoMode === 'motion' && hasMotionModels;
  const isEditView = jobType === 'video' && videoMode === 'edit' && hasEditModels;
  const isImageComposer = jobType === 'image';
  const isMusicComposer = jobType === 'music';
  const isTwoTabComposer = isMotionView || isImageComposer;
  const typeLabel = useCallback(
    (type: JobType = jobType) => t(`jobType.${type}` as TranslationKey),
    [t, jobType],
  );
  const isVideoAgentView =
    jobType === 'video' &&
    composerMode === 'ai' &&
    videoMode === 'create' &&
    !isMotionView &&
    !isEditView;
  // Lọc model cho picker theo chế độ video đang chọn.
  const pickerModels = useMemo(() => {
    if (jobType !== 'video') return models;
    if (videoMode === 'motion' && hasMotionModels) return models.filter(isMotionModel);
    if (videoMode === 'edit' && hasEditModels) return models.filter(isEditModel);
    if (hasMotionModels || hasEditModels) {
      return models.filter((m) => !isMotionModel(m) && !isEditModel(m));
    }
    return models;
  }, [models, jobType, videoMode, hasMotionModels, hasEditModels]);

  const currentModel = models.find((m) => modelSlug(m) === selectedSlug) ?? null;
  const multiShotConfig = useMemo(() => getMultiShotConfig(currentModel), [currentModel]);
  const activeShots = useMemo(
    () => (selections.shots || []).filter((s) => s.prompt?.trim()),
    [selections.shots],
  );
  const scriptCount = multiShotEnabled && schema?.fields.multiShots ? activeShots.length : 1;
  const modelPrice = currentModel?.price ?? 0;
  const unitCost = modelPrice;
  const motionRatePerSec = useMemo(
    () =>
      isMotionView && currentModel
        ? resolveMotionRatePerSecond(
            currentModel,
            selections.mode || '',
            selections.resolution || '',
          )
        : 0,
    [isMotionView, currentModel, selections.mode, selections.resolution],
  );
  const motionPromoPercent = useMemo(
    () => (isMotionView && currentModel ? getMotionPromotionPercent(currentModel) : 0),
    [isMotionView, currentModel],
  );
  const motionQuote = useMemo(() => {
    if (!isMotionView || !currentModel || motionVideoDuration <= 0) {
      return {
        billedSeconds: 0,
        saleRatePerSec: motionRatePerSec,
        originalRatePerSec: 0,
        scriptCount,
        promoPercent: motionPromoPercent,
        grossTotal: 0,
        finalTotal: 0,
      };
    }
    return computeMotionPriceQuote(
      currentModel,
      selections.mode || '',
      selections.resolution || '',
      motionVideoDuration,
      scriptCount,
    );
  }, [
    isMotionView,
    currentModel,
    motionVideoDuration,
    scriptCount,
    selections.mode,
    selections.resolution,
    motionRatePerSec,
    motionPromoPercent,
  ]);
  const motionBilledSeconds = useMemo(
    () =>
      isMotionView && motionVideoDuration > 0
        ? getMotionBilledSeconds(motionVideoDuration, currentModel)
        : 0,
    [isMotionView, motionVideoDuration, currentModel],
  );
  const motionGrossTotal = motionQuote.grossTotal;
  const motionTotalCost = motionQuote.finalTotal;
  // Composer hiển thị giá động theo mode + resolution đang chọn (khớp 79AI);
  // fallback về unitCost nếu model chưa có bảng giá.
  const composerCost = useMemo(() => {
    if (isMotionView) return motionRatePerSec;
    return resolveModelPrice(currentModel, selections.mode || '', selections.resolution || '') || unitCost;
  }, [isMotionView, motionRatePerSec, currentModel, selections.mode, selections.resolution, unitCost]);
  const submitQty = composerMode === 'multi' ? 1 : qty;
  const submitTotalCost = useMemo(() => {
    if (isMotionView) {
      return motionTotalCost * submitQty;
    }
    if (composerMode === 'multi') {
      return selectedSlugs.reduce((sum, slug) => {
        const m = pickerModels.find((x) => modelSlug(x) === slug);
        if (!m) return sum;
        return sum + (resolveModelPrice(m, selections.mode || '', selections.resolution || '') || unitCost);
      }, 0);
    }
    return (composerCost || 0) * submitQty;
  }, [
    isMotionView,
    motionTotalCost,
    submitQty,
    composerMode,
    selectedSlugs,
    pickerModels,
    composerCost,
    selections.mode,
    selections.resolution,
    unitCost,
  ]);

  function switchComposerMode(mode: ComposerMode) {
    setComposerMode(mode);
    localStorage.setItem('studioComposerMode', mode);
    if (mode === 'multi') {
      setSelectedSlugs((prev) =>
        prev.length ? prev : selectedSlug ? [selectedSlug] : [],
      );
    } else if (selectedSlug) {
      setSelectedSlugs([selectedSlug]);
    }
  }

  function switchInputMode(mode: 'frame' | 'component') {
    setInputMode(mode);
    localStorage.setItem('studioInputMode', mode);
  }

  function toggleNormalizePrompt(on: boolean) {
    setNormalizePrompt(on);
    localStorage.setItem('studioNormalize', on ? '1' : '0');
  }

  useEffect(() => {
    if (
      (isMotionView || isImageComposer) &&
      (composerMode === 'multi' || composerMode === 'ai')
    ) {
      setComposerMode('single');
      localStorage.setItem('studioComposerMode', 'single');
    }
    if (isEditView && (composerMode === 'multi' || composerMode === 'ai' || composerMode === 'auto')) {
      setComposerMode('single');
      localStorage.setItem('studioComposerMode', 'single');
    }
    if (
      isMusicComposer &&
      (composerMode === 'multi' || composerMode === 'ai' || composerMode === 'auto')
    ) {
      setComposerMode('single');
      localStorage.setItem('studioComposerMode', 'single');
    }
  }, [isMotionView, isEditView, isImageComposer, isMusicComposer, composerMode]);

  useEffect(() => {
    if (!isMotionView || !motionVideoUrl) {
      setMotionVideoDuration(0);
      setMotionDurationLoading(false);
      return;
    }
    let cancelled = false;
    setMotionDurationLoading(true);
    probeVideoDurationFromUrl(motionVideoUrl)
      .then((d) => {
        if (!cancelled) setMotionVideoDuration(d > 0 ? d : 0);
      })
      .catch(() => {
        if (!cancelled) setMotionVideoDuration(0);
      })
      .finally(() => {
        if (!cancelled) setMotionDurationLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isMotionView, motionVideoUrl]);

  useEffect(() => {
    if (!schema?.fields.multiShots) {
      setMultiShotEnabled(false);
    }
  }, [schema?.fields.multiShots, selectedSlug]);

  const loadModelsList = useCallback(
    async (type: JobType) => {
      if (!client) return;
      setLoadingModels(true);
      setError('');
      try {
        const list = parseModelsList(await client.fetchModels(type));
        setModels(list);
        if (!list.length) setError(`Không có model ${type}.`);
      } catch (err) {
        setError(err instanceof GommoApiError ? err.message : String(err));
        setModels([]);
      } finally {
        setLoadingModels(false);
      }
    },
    [client],
  );

  const loadRecentJobs = useCallback(() => {
    setRecentJobs(listLocalJobs());
  }, []);

  useEffect(() => {
    loadRecentJobs();
  }, [loadRecentJobs]);

  const applyReuse = useCallback((entry: HistoryEntry) => {
    const t = entry.type as JobType;
    if (!REUSABLE_JOB_TYPES.includes(t)) return;
    setJobType(t);
    setSelectedSlug(entry.modelSlug || '');
    const base = defaultSelectionsForType(t);
    setSelections({
      ...base,
      prompt: t === 'tts' || t === 'music' ? base.prompt : entry.prompt || base.prompt,
      text: t === 'tts' ? entry.prompt || base.text : base.text,
      name: t === 'music' ? entry.prompt || base.name : base.name,
      mode: entry.meta?.mode || '',
      resolution: entry.meta?.resolution || '',
      ratio: entry.meta?.ratio || '',
      duration: entry.meta?.duration || '',
    });
  }, []);

  const buildPreviewHandlers = useCallback(
    (
      item: FeedItem,
      mediaUrl: string,
      onClosePreview: () => void,
      onDelete?: () => void,
    ): ComposerPreviewHandlers => {
      const entry = feedItemToHistoryEntry(item, jobType, mediaUrl);
      return {
        onRegenerate: () => {
          applyReuse(entry);
          onClosePreview();
        },
        onCreateVideo:
          jobType === 'image' && mediaUrl
            ? () => {
                switchJobType('video');
                setSelections({
                  ...defaultSelectionsForType('video'),
                  prompt: item.prompt || '',
                  references: [mediaUrl],
                });
                onClosePreview();
              }
            : undefined,
        onEdit: mediaUrl
          ? () => {
              switchJobType('image');
              setSelections({
                ...defaultSelectionsForType('image'),
                prompt: item.prompt || '',
                references: [mediaUrl],
              });
              onClosePreview();
            }
          : undefined,
        onDelete,
        onUpscaleDone: (resultUrl) => {
          addHistoryEntry({
            type: 'image',
            resultUrl,
            prompt: item.prompt ? `${item.prompt} (upscale)` : 'Upscale ảnh',
            modelSlug: 'generative_upscale_v2',
            modelName: 'Nâng cấp ảnh AI',
            meta: {
              resolution: item.resolution || '',
              ratio: item.ratio || '',
            },
          });
          setHistoryTick((n) => n + 1);
          onClosePreview();
        },
      };
    },
    [applyReuse, jobType],
  );

  useEffect(() => {
    const reuse = (location.state as { reuseHistory?: {
      type: JobType;
      prompt?: string;
      modelSlug?: string;
      meta?: Record<string, string>;
    } } | null)?.reuseHistory;
    if (!reuse?.type || !REUSABLE_JOB_TYPES.includes(reuse.type)) return;
    applyReuse({
      id: '',
      type: jobTypeToHistoryType(reuse.type),
      resultUrl: '',
      prompt: reuse.prompt,
      modelSlug: reuse.modelSlug,
      createdAt: new Date().toISOString(),
      meta: reuse.meta,
    });
  }, [location.key, applyReuse]);

  useEffect(() => {
    void loadModelsList(jobType);
  }, [jobType, loadModelsList]);

  useEffect(() => {
    const reuse = (location.state as { reuseHistory?: {
      type: JobType;
      modelSlug?: string;
    } } | null)?.reuseHistory;
    if (!reuse || reuse.type !== jobType || !models.length || !reuse.modelSlug) return;
    if (models.some((m) => modelSlug(m) === reuse.modelSlug)) {
      setSelectedSlug(reuse.modelSlug);
    }
  }, [models, jobType, location.state]);

  // Luôn chọn sẵn 1 model khi vào trang / đổi loại job (giống 79AI): ưu tiên model
  // dùng gần đây còn khả dụng, rồi tới model đầu tiên đang ON.
  useEffect(() => {
    if (!pickerModels.length) return;
    if (selectedSlug && pickerModels.some((m) => modelSlug(m) === selectedSlug)) return;
    const bySlug = new Map(pickerModels.map((m) => [modelSlug(m), m] as const));
    const recent = loadRecentModelSlugs()
      .map((s) => bySlug.get(s))
      .find((m) => m && !isModelMaintenance(m));
    const fallback = pickerModels.find((m) => !isModelMaintenance(m)) ?? pickerModels[0];
    const pick = recent ?? fallback;
    if (pick) setSelectedSlug(modelSlug(pick));
  }, [pickerModels, selectedSlug]);

  useEffect(() => {
    if (!currentModel) {
      setSchema(null);
      return;
    }
    const s = analyzeModel(currentModel, jobType);
    setSchema(s);
    setSelections((prev) => {
      const defs = defaultSelections(s);
      const defaults = defaultSelectionsForType(jobType);
      return {
        ...defs,
        prompt: prev.prompt || defaults.prompt,
        text: prev.text || defaults.text,
        name: prev.name || defaults.name,
        mode: prev.mode || defs.mode,
        ratio: prev.ratio || defs.ratio,
        resolution: prev.resolution || defs.resolution,
        duration: prev.duration || defs.duration,
        images: prev.images?.length ? prev.images : defs.images,
        references: prev.references?.length ? prev.references : defs.references,
        subjects: prev.subjects?.length ? prev.subjects : defs.subjects,
      };
    });
  }, [currentModel, jobType]);

  async function handleUpload(file: File, kind: 'image' | 'video') {
    if (!client) return null;
    setError('');
    try {
      const { url } = kind === 'image'
        ? await client.uploadImage(file)
        : await client.uploadVideo(file);
      return url;
    } catch (err) {
      setError(err instanceof GommoApiError || err instanceof Error ? err.message : String(err));
      return null;
    }
  }

  function updateSelection<K extends keyof JobSelections>(key: K, value: JobSelections[K]) {
    setSelections((s) => ({ ...s, [key]: value }));
  }

  function updateUrlList(key: 'images' | 'references' | 'subjects', index: number, value: string) {
    setSelections((s) => {
      const list = [...(s[key] || [])];
      list[index] = value;
      return { ...s, [key]: list };
    });
  }

  function bumpPendingProgress(pendingId: string, progress: number) {
    setPendingJobs((prev) =>
      prev.map((p) =>
        p.id === pendingId
          ? { ...p, progress: Math.min(99, Math.max(p.progress ?? 5, progress)) }
          : p,
      ),
    );
  }

  function recordSuccess(
    url: string,
    slug: string,
    promptOverride?: string,
    modelOverride?: GommoModel,
  ) {
    const prompt = promptOverride ?? historyPromptFromSelections(jobType, selections);
    const model = modelOverride ?? currentModel;
    const meta = {
      mode: selections.mode || '',
      resolution: selections.resolution || '',
      ratio: selections.ratio || '',
      duration: selections.duration || '',
    };
    const createdAt = new Date().toISOString();

    addHistoryEntry({
      type: jobTypeToHistoryType(jobType),
      resultUrl: url,
      prompt,
      modelName: model?.name || slug,
      modelSlug: slug,
      meta,
    });

    setSessionItems((prev) => [
      {
        id: crypto.randomUUID(),
        type: jobType,
        resultUrl: url,
        prompt,
        modelName: model?.name || slug,
        modelSlug: slug,
        createdAt,
      },
      ...prev,
    ]);
  }

  // Chạy 1 job với prompt riêng (dùng cho cả tạo đơn và batch multi-prompt).
  // refUrl (nếu có) ghi đè ảnh tham chiếu cho riêng prompt này.
  async function runOneJob(
    slug: string,
    prompt: string,
    pendingId: string,
    refUrl?: string,
    overrides?: Partial<JobSelections>,
    modelOverride?: GommoModel,
  ): Promise<boolean> {
    const model = modelOverride ?? currentModel!;
    const jobSchema = modelOverride ? analyzeModel(model, jobType) : schema!;
    const runSelections: JobSelections = { ...selections, prompt, ...overrides };
    if (refUrl) {
      if (jobSchema.fields.references) runSelections.references = [refUrl];
      else if (jobSchema.fields.subjects) runSelections.subjects = [refUrl];
      else runSelections.images = [refUrl];
    }
    const { payload } = buildJobPayload(model, jobType, runSelections, {
      domain: auth?.domain,
      projectId: auth?.projectId,
    });

    const localId = crypto.randomUUID();
    addLocalJob({
      id: localId,
      type: jobType,
      model_id: slug,
      status: 'processing',
      created_at: new Date().toISOString(),
    });
    loadRecentJobs();

    try {
      const finalUrl = await generateViaGommo(slug, payload, pendingId);

      if (finalUrl) {
        setResultUrl(finalUrl);
        updateLocalJob(localId, { status: 'success', result_url: finalUrl });
        recordSuccess(finalUrl, slug, prompt, model);
        setPendingJobs((prev) => prev.filter((p) => p.id !== pendingId));
        loadRecentJobs();
        return true;
      }
      const errMsg = 'Job thất bại';
      setError(errMsg);
      updateLocalJob(localId, { status: 'failed', error: errMsg });
      setPendingJobs((prev) =>
        prev.map((p) => (p.id === pendingId ? { ...p, status: 'failed' } : p)),
      );
      loadRecentJobs();
      return false;
    } catch (err) {
      const msg = err instanceof GommoApiError || err instanceof Error ? err.message : String(err);
      setError(msg);
      updateLocalJob(localId, { status: 'failed', error: msg });
      setPendingJobs((prev) =>
        prev.map((p) => (p.id === pendingId ? { ...p, status: 'failed' } : p)),
      );
      loadRecentJobs();
      return false;
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!client || !currentModel || !schema) {
      setError('Chọn model trước.');
      return;
    }

    if (
      !isMotionView &&
      !isEditView &&
      schema.fields.references &&
      (!schema.fields.startFrame || inputMode === 'component')
    ) {
      const refs = (selections.references || []).filter(Boolean);
      const imgC = refs.filter((u) => urlMediaKind(u) !== 'video').length;
      const vidC = refs.filter((u) => urlMediaKind(u) === 'video').length;
      const limits = getReferenceLimits(currentModel, schema, jobType);
      if (imgC > limits.image) {
        setError(`Quá nhiều ảnh tham chiếu (tối đa ${limits.image}).`);
        return;
      }
      if (vidC > limits.video) {
        setError(`Quá nhiều video tham chiếu (tối đa ${limits.video}).`);
        return;
      }
    }

    // Chế độ Motion: cần ảnh nhân vật + video tham chiếu; Auto + Multi-Prompt → batch.
    if (isMotionView) {
      const charUrl = (selections.images || []).find(Boolean) || '';
      if (!charUrl) {
        setError('Tải ảnh nhân vật trước.');
        return;
      }
      if (!motionVideoUrl) {
        setError('Tải video tham chiếu trước.');
        return;
      }

      const useMotionMulti = composerMode === 'auto' && multiPrompt;
      let motionPrompts: string[];
      const baseMotionPrompt = selections.prompt || '';
      if (useMotionMulti) {
        const sep = promptSeparator.trim() || '=====';
        const escaped = sep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        motionPrompts = baseMotionPrompt
          .split(new RegExp(escaped))
          .map((p) => p.trim())
          .filter(Boolean);
        if (motionPrompts.length === 0) {
          setError(`Nhập ít nhất 1 prompt (mỗi prompt cách nhau bằng ${sep}).`);
          return;
        }
      } else {
        motionPrompts = [baseMotionPrompt];
      }

      abortRef.current?.abort();
      abortRef.current = new AbortController();
      setSubmitting(true);
      setError('');
      setProgress('Đang tạo job…');
      setResultUrl(null);
      const slug = modelSlug(currentModel);

      try {
        motionPrompts = await normalizePromptsList(motionPrompts);
        const motionTasks = motionPrompts.map((prompt) => ({
          prompt,
          pendingId: crypto.randomUUID(),
        }));
        setPendingJobs((prev) => [
          ...motionTasks.map((t) => ({
            id: t.pendingId,
            prompt: t.prompt,
            status: 'processing' as const,
            progress: 5,
          })),
          ...prev.filter((p) => p.status === 'processing'),
        ]);

        const limit = Math.max(1, Math.min(concurrencyLimit, motionTasks.length));
        let cursor = 0;
        const worker = async () => {
          while (cursor < motionTasks.length) {
            const i = cursor++;
            const t = motionTasks[i];
            await runOneJob(slug, t.prompt, t.pendingId, undefined, {
              images: [charUrl],
              extra: {
                ...(selections.extra || {}),
                subType: 'motion',
                image_url: charUrl,
                video_url: motionVideoUrl,
              },
            });
          }
        };
        await Promise.all(Array.from({ length: limit }, () => worker()));
        setProgress('Hoàn tất!');
        await refreshCreditsAfterJob();
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Chế độ Edit: sửa video có sẵn theo prompt.
    if (isEditView) {
      if (!editVideoUrl) {
        setError('Tải video cần sửa trước.');
        return;
      }
      const editPrompt = (selections.prompt || '').trim();
      if (!editPrompt) {
        setError('Nhập mô tả chỉnh sửa.');
        return;
      }

      abortRef.current?.abort();
      abortRef.current = new AbortController();
      setSubmitting(true);
      setError('');
      setProgress('Đang tạo job…');
      setResultUrl(null);
      const slug = modelSlug(currentModel);
      const pendingId = crypto.randomUUID();
      setPendingJobs((prev) => [
        { id: pendingId, prompt: editPrompt, status: 'processing', progress: 5 },
        ...prev.filter((p) => p.status === 'processing'),
      ]);

      try {
        let prompt = editPrompt;
        if (normalizePrompt) {
          [prompt] = await normalizePromptsList([prompt]);
        }
        await runOneJob(slug, prompt, pendingId, undefined, {
          extra: {
            ...(selections.extra || {}),
            subType: 'edit',
            video_url: editVideoUrl,
          },
        });
        setProgress('Hoàn tất!');
        await refreshCreditsAfterJob();
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const batchType = jobType === 'image' || jobType === 'video';
    const useMultiPrompt = composerMode === 'auto' && multiPrompt && batchType;
    let basePrompt = selections.prompt || '';
    if (multiShotEnabled && schema.fields.multiShots && activeShots.length >= 2) {
      basePrompt = activeShots.map((s) => s.prompt.trim()).filter(Boolean).join(' · ');
    }
    if (composerMode === 'ai' && !isVideoAgentView && !basePrompt.trim() && aiBrief.trim()) {
      basePrompt = expandBriefToPrompt(aiBrief, jobType);
    }

    if (isVideoAgentView) {
      const hasAgentScript =
        multiShotEnabled && schema.fields.multiShots && activeShots.length >= 2
          ? true
          : Boolean(basePrompt.trim());
      if (!hasAgentScript) {
        setError('Chat với Video Agent để có kịch bản / prompt trước khi tạo.');
        return;
      }
    }

    if (composerMode === 'multi') {
      const validSlugs = selectedSlugs.filter((s) =>
        pickerModels.some((m) => modelSlug(m) === s),
      );
      if (validSlugs.length === 0) {
        setError('Chọn ít nhất 1 model.');
        return;
      }
    }

    if (multiShotEnabled && schema.fields.multiShots) {
      if (activeShots.length < multiShotConfig.minShots) {
        setError(`Cần ít nhất ${multiShotConfig.minShots} cảnh (kịch bản).`);
        return;
      }
      if (activeShots.length > multiShotConfig.maxShots) {
        setError(`Tối đa ${multiShotConfig.maxShots} cảnh.`);
        return;
      }
    }

    // Danh sách prompt cần tạo:
    // ngược lại lặp theo số lượng (qty) cho image/video, các loại khác giữ 1 job.
    let prompts: string[];
    if (useMultiPrompt) {
      const sep = promptSeparator.trim() || '=====';
      const escaped = sep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      prompts = basePrompt
        .split(new RegExp(escaped))
        .map((p) => p.trim())
        .filter(Boolean);
      if (prompts.length === 0) {
        setError(`Nhập ít nhất 1 prompt (mỗi prompt cách nhau bằng ${sep}).`);
        return;
      }
    } else {
      prompts =
        batchType && composerMode !== 'multi'
          ? Array.from({ length: qty }, () => basePrompt)
          : [basePrompt];
    }

    if (normalizePrompt) prompts = await normalizePromptsList(prompts);

    // Gán ảnh tham chiếu cho từng prompt theo quy cách chọn (chỉ khi bật multi-prompt
    // + "mỗi prompt 1 tham chiếu" + có ảnh trong multiRefs).
    const refForIndex = (i: number): string | undefined => {
      if (!useMultiPrompt || !perPromptRef || multiRefs.length === 0) return undefined;
      if (refSelectMode === 'fixed') return multiRefs[0];
      if (refSelectMode === 'random') {
        return multiRefs[Math.floor(Math.random() * multiRefs.length)];
      }
      return multiRefs[i % multiRefs.length];
    };

    type JobTask = { slug: string; prompt: string; model: GommoModel; pendingId: string };
    let tasks: JobTask[];

    if (composerMode === 'multi') {
      const validSlugs = selectedSlugs.filter((s) =>
        pickerModels.some((m) => modelSlug(m) === s),
      );
      tasks = validSlugs.map((slug) => {
        const model = pickerModels.find((m) => modelSlug(m) === slug)!;
        return {
          slug,
          prompt: prompts[0] || '',
          model,
          pendingId: crypto.randomUUID(),
        };
      });
    } else {
      tasks = prompts.map((prompt) => ({
        slug: modelSlug(currentModel),
        prompt,
        model: currentModel!,
        pendingId: crypto.randomUUID(),
      }));
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setSubmitting(true);
    setError('');
    setProgress('Đang tạo job…');
    setResultUrl(null);

    const newPending: PendingJob[] = tasks.map((t) => ({
      id: t.pendingId,
      prompt: t.prompt,
      status: 'processing' as const,
      progress: 5,
    }));
    setPendingJobs((prev) => [...newPending, ...prev.filter((p) => p.status === 'processing')]);

    try {
      const limit = Math.max(1, Math.min(concurrencyLimit, tasks.length));
      let cursor = 0;
      const worker = async () => {
        while (cursor < tasks.length) {
          const i = cursor++;
          const task = tasks[i];
          await runOneJob(
            task.slug,
            task.prompt,
            task.pendingId,
            composerMode === 'multi' ? undefined : refForIndex(i),
            undefined,
            composerMode === 'multi' ? task.model : undefined,
          );
        }
      };
      await Promise.all(Array.from({ length: limit }, () => worker()));
      setProgress('Hoàn tất!');
      await refreshCreditsAfterJob();
    } finally {
      setSubmitting(false);
    }
  }

  async function refreshCreditsAfterJob() {
    try {
      const refreshed = await refreshSession();
      setCredits(refreshed.upstream_me.balancesInfo?.credits_ai ?? credits);
    } catch {
      /* ignore */
    }
    notifyCreditsUpdated();
  }

  async function generateViaGommo(
    slug: string,
    payload: Record<string, unknown>,
    pendingId?: string,
  ): Promise<string | null> {
    const { pollResult, resultUrl: url, createEnvelope } = await createJobAndPoll(
      client!,
      jobType,
      slug,
      payload,
      (p) => {
        if ('phase' in p && p.phase === 'creating') {
          setProgress('Đang gửi request tạo job…');
          if (pendingId) bumpPendingProgress(pendingId, 10);
          return;
        }
        const prog = p as PollProgress;
        setProgress(`Poll #${prog.attempt}: ${prog.status || prog.phase}`);
        if (pendingId) bumpPendingProgress(pendingId, 12 + prog.attempt * 3);
        if (prog.resultUrl) setResultUrl(prog.resultUrl);
      },
      abortRef.current!.signal,
    );

    const snap = extractPollSnapshot(createEnvelope as Parameters<typeof extractPollSnapshot>[0]);
    const finalUrl = url ?? snap.resultUrl;
    if (finalUrl) return finalUrl;
    throw new Error(pollResult?.error || 'Job thất bại');
  }

  const processingJobs = recentJobs.filter((j) => j.type === jobType && j.status === 'processing');

  function switchJobType(type: JobType) {
    setJobType(type);
    setSelectedSlug('');
    setSchema(null);
    setResultUrl(null);
    setPendingJobs([]);
    setMultiRefs([]);
    setMotionVideoUrl('');
    setEditVideoUrl('');
    setVideoMode('create');
    setMultiShotEnabled(false);
    setInputMode('frame');
    localStorage.setItem('studioInputMode', 'frame');
    setSelections(defaultSelectionsForType(type));
  }

  const composerResults = useMemo(
    () => listHistory(jobTypeToHistoryType(jobType)),
    [jobType, historyTick, resultUrl],
  );

  const useClibLayout = historyJobUsesClibLayout(jobType);

  const displayedResults = useMemo(() => {
    if (mainTab === 'current') {
      return composerResults.filter(
        (e) => new Date(e.createdAt).getTime() >= sessionStartRef.current,
      );
    }
    return composerResults;
  }, [mainTab, composerResults]);

  const toolbarCount =
    mainTab === 'folder'
      ? libraryCount
      : mainTab === 'history'
        ? historyCount
        : displayedResults.length;

  const groupedResults = useMemo(() => {
    const map = new Map<string, HistoryEntry[]>();
    for (const e of displayedResults) {
      const day = dateGroupLabel(e.createdAt, t);
      const list = map.get(day);
      if (list) list.push(e);
      else map.set(day, [e]);
    }
    return [...map.entries()];
  }, [displayedResults, t]);

  const visibleIds = useMemo(() => displayedResults.map((e) => e.id), [displayedResults]);

  const currentPreviewItems = useMemo(
    () => historyEntriesToFeedItems(displayedResults, jobType),
    [displayedResults, jobType],
  );

  const currentPreviewIndexById = useMemo(() => {
    const map = new Map<string, number>();
    currentPreviewItems.forEach((item, index) => {
      map.set(item.id_base, index);
    });
    return map;
  }, [currentPreviewItems]);

  const selectableIds = useMemo(() => {
    if (mainTab === 'folder') return libraryVisibleIds;
    if (mainTab === 'history') return historyVisibleIds;
    if (mainTab === 'current') return visibleIds;
    return [];
  }, [mainTab, libraryVisibleIds, historyVisibleIds, visibleIds]);

  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));
  const selectionCount = selectedIds.size;

  useEffect(() => {
    setSelectedIds(new Set());
    setCurrentPreviewIndex(null);
  }, [mainTab, jobType]);

  // Bỏ chọn các id không còn hiển thị (đổi tab/loại job).
  useEffect(() => {
    setSelectedIds((prev) => {
      if (!prev.size) return prev;
      const visible = new Set(selectableIds);
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [selectableIds]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds(allSelected ? new Set() : new Set(selectableIds));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function downloadSelected() {
    for (const id of selectedIds) {
      const url =
        mainTab === 'folder'
          ? libraryUrlMap[id]
          : mainTab === 'history'
            ? historyUrlMap[id]
            : displayedResults.find((e) => e.id === id)?.resultUrl;
      if (!url) continue;
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noreferrer';
      a.download = '';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }

  function deleteSelected() {
    if (mainTab === 'folder' || mainTab === 'history') {
      if (!selectedIds.size) return;
      const label = mainTab === 'folder' ? 'thư viện' : 'lịch sử';
      if (!window.confirm(`Xóa ${selectedIds.size} mục đã chọn khỏi ${label}?`)) return;
      void (async () => {
        setError('');
        try {
          for (const id of selectedIds) {
            await deleteFeedPost(id);
          }
          setHistoryTick((n) => n + 1);
          clearSelection();
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        }
      })();
      return;
    }
    for (const id of selectedIds) removeHistoryEntry(id);
    clearSelection();
  }

  function handleFeedItemDeleted(id: string) {
    setHistoryTick((n) => n + 1);
    setSelectedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function handleCurrentDelete(entry: HistoryEntry) {
    if (!window.confirm('Xóa mục này khỏi phiên hiện tại?')) return;
    setCurrentDeletingId(entry.id);
    try {
      removeHistoryEntry(entry.id);
      setCurrentPreviewIndex((prev) => {
        if (prev == null) return null;
        const deletedIndex = currentPreviewIndexById.get(entry.id);
        if (deletedIndex == null || deletedIndex < 0) return prev;
        if (prev === deletedIndex) return null;
        if (prev > deletedIndex) return prev - 1;
        return prev;
      });
    } finally {
      setCurrentDeletingId('');
    }
  }

  function startResize(e: ReactPointerEvent<HTMLDivElement>) {
    e.preventDefault();
    resizingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: PointerEvent) => {
      if (!resizingRef.current || !composerRef.current) return;
      const rect = composerRef.current.getBoundingClientRect();
      const w = Math.max(320, Math.min(640, ev.clientX - rect.left - 16));
      sideWidthRef.current = w;
      setSideWidth(w);
    };
    const onUp = () => {
      resizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem('studioSideWidth', String(Math.round(sideWidthRef.current)));
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  // Khối nhập media: model có thể hỗ trợ Ảnh Frame (start/end) và/hoặc Thành phần (tham chiếu).
  const hasFrame = !isMotionView && !isEditView && Boolean(schema?.fields.startFrame);
  const hasComponent =
    !isMotionView && !isEditView && Boolean(schema?.fields.references || schema?.fields.subjects);
  const showInputTabs = hasFrame && hasComponent;
  const inputView: 'frame' | 'component' = showInputTabs
    ? inputMode
    : hasFrame
      ? 'frame'
      : 'component';
  const componentKey: 'references' | 'subjects' = schema?.fields.references ? 'references' : 'subjects';
  const refLimits = getReferenceLimits(currentModel, schema, jobType);
  const maxComponents = schema?.fields.references
    ? refLimits.image + refLimits.video || schema.limits.maxReference || 4
    : schema?.limits.maxSubject || 1;
  const componentList = (selections[componentKey] || []).filter(Boolean);
  const componentImageCount = componentList.filter((u) => urlMediaKind(u) !== 'video').length;
  const componentVideoCount = componentList.filter((u) => urlMediaKind(u) === 'video').length;
  const canAddComponentImage =
    componentKey === 'references'
      ? refLimits.image > 0 && componentImageCount < refLimits.image
      : componentList.length < maxComponents;
  const canAddComponentVideo =
    componentKey === 'references' && refLimits.video > 0 && componentVideoCount < refLimits.video;
  const canAddComponentAny = canAddComponentImage || canAddComponentVideo;

  const addComponent = (url: string, kind: 'image' | 'video') => {
    setSelections((s) => {
      const list = (s[componentKey] || []).filter(Boolean);
      if (componentKey === 'references') {
        const imgC = list.filter((u) => urlMediaKind(u) !== 'video').length;
        const vidC = list.filter((u) => urlMediaKind(u) === 'video').length;
        if (kind === 'video') {
          if (vidC >= refLimits.video) return s;
        } else if (imgC >= refLimits.image) {
          return s;
        }
      } else if (list.length >= maxComponents) {
        return s;
      }
      return { ...s, [componentKey]: [...list, url] };
    });
  };
  const removeComponent = (idx: number) => {
    setSelections((s) => {
      const list = [...(s[componentKey] || [])];
      list.splice(idx, 1);
      return { ...s, [componentKey]: list };
    });
  };

  async function ingestMediaFile(
    file: File,
    target: 'component' | 'frameStart' | 'frameEnd' | 'motionChar' | 'motionVideo' | 'editVideo',
  ) {
    const kind =
      target === 'motionVideo' || target === 'editVideo' || mediaKindFromFile(file) === 'video'
        ? 'video'
        : 'image';

    if (target === 'component') {
      const fileKind = mediaKindFromFile(file);
      if (fileKind === 'video' && !canAddComponentVideo) {
        setError('Đã đạt giới hạn video tham chiếu.');
        return;
      }
      if (fileKind === 'image' && !canAddComponentImage) {
        setError('Đã đạt giới hạn ảnh tham chiếu.');
        return;
      }
    }

    const rules = getUploadRules(currentModel, mapUploadTarget(target, kind));
    const validationError = await validateMediaFile(file, rules, kind);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    const url = await handleUpload(file, kind);
    if (!url) return;
    if (target === 'motionVideo' && kind === 'video') {
      try {
        const dur = await probeVideoDuration(file);
        if (dur > 0) setMotionVideoDuration(dur);
      } catch {
        /* useEffect sẽ thử đọc từ URL */
      }
    }
    if (target === 'component') addComponent(url, kind);
    else if (target === 'frameStart') updateUrlList('images', 0, url);
    else if (target === 'frameEnd') updateUrlList('images', 1, url);
    else if (target === 'motionChar') updateUrlList('images', 0, url);
    else if (target === 'motionVideo') setMotionVideoUrl(url);
    else if (target === 'editVideo') setEditVideoUrl(url);
  }

  function ingestMediaUrl(
    url: string,
    target: 'component' | 'frameStart' | 'frameEnd' | 'motionChar' | 'motionVideo' | 'editVideo',
  ) {
    const expectedKind =
      target === 'motionVideo' || target === 'editVideo'
        ? 'video'
        : target === 'component'
          ? 'any'
          : 'image';

    const validationError = validateMediaUrl(url, expectedKind);
    if (validationError) {
      setError(validationError);
      return;
    }

    const kind = mediaKindFromUrl(url) === 'video' ? 'video' : 'image';

    if (target === 'component') {
      if (kind === 'video' && !canAddComponentVideo) {
        setError('Đã đạt giới hạn video tham chiếu.');
        return;
      }
      if (kind === 'image' && !canAddComponentImage) {
        setError('Đã đạt giới hạn ảnh tham chiếu.');
        return;
      }
    }

    setError('');
    if (target === 'component') addComponent(url, kind);
    else if (target === 'frameStart') updateUrlList('images', 0, url);
    else if (target === 'frameEnd') updateUrlList('images', 1, url);
    else if (target === 'motionChar') updateUrlList('images', 0, url);
    else if (target === 'motionVideo') setMotionVideoUrl(url);
    else if (target === 'editVideo') setEditVideoUrl(url);
  }

  function updateShot(id: string, patch: Partial<ComposerShot>) {
    setSelections((s) => ({
      ...s,
      shots: (s.shots || []).map((shot) => (shot.id === id ? { ...shot, ...patch } : shot)),
    }));
  }

  function addShotRow() {
    setSelections((s) => {
      const list = s.shots || [];
      if (list.length >= multiShotConfig.maxShots) return s;
      return { ...s, shots: [...list, newShot('')] };
    });
  }

  function removeShotRow(id: string) {
    setSelections((s) => ({
      ...s,
      shots: (s.shots || []).filter((shot) => shot.id !== id),
    }));
  }

  function enableMultiShot(on: boolean) {
    setMultiShotEnabled(on);
    if (on) {
      setSelections((s) => {
        const existing = (s.shots || []).filter((x) => x.prompt?.trim());
        if (existing.length >= multiShotConfig.minShots) return { ...s, shots: existing };
        const seed = s.prompt?.trim() || aiBrief.trim();
        const base = existing.length ? existing : seed ? [newShot(seed)] : [newShot('')];
        while (base.length < multiShotConfig.minShots) base.push(newShot(''));
        return { ...s, shots: base };
      });
    }
  }

  const handleAgentScript = useCallback(
    (data: { prompt?: string; shots?: ComposerShot[] }) => {
      if (data.shots && data.shots.length >= 2 && schema?.fields.multiShots) {
        setMultiShotEnabled(true);
        setSelections((s) => ({
          ...s,
          shots: data.shots,
          prompt: data.shots!.map((x) => x.prompt.trim()).filter(Boolean).join(' · '),
        }));
      } else if (data.prompt?.trim()) {
        setSelections((s) => ({ ...s, prompt: data.prompt!.trim() }));
        if (!schema?.fields.multiShots) setMultiShotEnabled(false);
      }
    },
    [schema],
  );

  async function generateShotsFromBrief() {
    const source = aiBrief.trim() || selections.prompt?.trim() || '';
    if (!source) {
      setError('Nhập ý tưởng trước khi sinh kịch bản.');
      return;
    }
    setEnhancingPrompt(true);
    setError('');
    try {
      const shots = canUseComposerPromptAi()
        ? await generateShotsWithAi(source, jobType, multiShotConfig.maxShots, {
            signal: abortRef.current?.signal,
          })
        : [
            newShot(expandBriefToPrompt(source, jobType)),
            newShot(`${expandBriefToPrompt(source, jobType)} — close-up detail shot.`),
          ];
      setMultiShotEnabled(true);
      setSelections((s) => ({ ...s, shots }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setEnhancingPrompt(false);
    }
  }

  async function generateAiPrompt() {
    const source = aiBrief.trim() || selections.prompt?.trim() || '';
    if (!source) {
      setError('Nhập ý tưởng ngắn trước.');
      return;
    }
    setEnhancingPrompt(true);
    setError('');
    try {
      const expanded = canUseComposerPromptAi()
        ? await enhancePromptWithAi(source, jobType)
        : expandBriefToPrompt(source, jobType);
      updateSelection('prompt', expanded);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setEnhancingPrompt(false);
    }
  }

  async function enhanceCurrentPrompt() {
    const source = selections.prompt?.trim() || aiBrief.trim() || '';
    if (!source) {
      setError('Nhập prompt trước.');
      return;
    }
    setEnhancingPrompt(true);
    setError('');
    try {
      const expanded = canUseComposerPromptAi()
        ? await enhancePromptWithAi(source, jobType)
        : expandBriefToPrompt(source, jobType);
      updateSelection('prompt', expanded);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setEnhancingPrompt(false);
    }
  }

  async function normalizePromptsList(prompts: string[]): Promise<string[]> {
    if (!normalizePrompt) return prompts;
    return Promise.all(
      prompts.map(async (p) => {
        const raw = p.trim();
        if (!raw) return p;
        try {
          if (canUseComposerPromptAi()) {
            return await normalizePromptWithAi(raw, jobType, {
              signal: abortRef.current?.signal,
            });
          }
        } catch {
          /* fallback local */
        }
        return normalizeOnePrompt(raw);
      }),
    );
  }

  if (layout === 'composer') {
    return (
      <div
        className="studio-composer"
        ref={composerRef}
        style={{ gridTemplateColumns: `${sideWidth}px 6px 1fr` }}
      >
        <aside
          className={`composer-side${isVideoAgentView ? ' composer-side-agent' : ''}`}
          onPaste={(e) => {
            const file = [...(e.clipboardData?.files ?? [])][0];
            if (!file) return;
            e.preventDefault();
            if (isMotionView) {
              if (!selections.images?.[0]) void ingestMediaFile(file, 'motionChar');
              else if (!motionVideoUrl) void ingestMediaFile(file, 'motionVideo');
              return;
            }
            if (isEditView) {
              if (!editVideoUrl) void ingestMediaFile(file, 'editVideo');
              return;
            }
            if (inputView === 'frame') {
              if (!selections.images?.[0]) void ingestMediaFile(file, 'frameStart');
              else if (schema?.fields.endFrame && !selections.images?.[1]) {
                void ingestMediaFile(file, 'frameEnd');
              }
            } else if (canAddComponentAny) {
              void ingestMediaFile(file, 'component');
            }
          }}
        >
          <div className="composer-side-head">
            <button
              type="button"
              className="composer-back"
              aria-label={t('composer.back')}
              onClick={() => navigate(-1)}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="composer-title">
              {t('composer.create', { type: typeLabel() })}
            </span>
          </div>

          {(jobType === 'video' && (hasMotionModels || hasEditModels)) && (
            <div className={`composer-videomode-tabs${hasEditModels && hasMotionModels ? ' composer-videomode-tabs-3' : ''}`}>
              <button
                type="button"
                className={videoMode === 'create' ? 'active' : ''}
                onClick={() => setVideoMode('create')}
              >
                <Clapperboard size={14} />
                {t('composer.video.create')}
              </button>
              {hasMotionModels && (
                <button
                  type="button"
                  className={videoMode === 'motion' ? 'active' : ''}
                  onClick={() => setVideoMode('motion')}
                >
                  <PersonStanding size={14} />
                  {t('composer.video.motion')}
                </button>
              )}
              {hasEditModels && (
                <button
                  type="button"
                  className={videoMode === 'edit' ? 'active' : ''}
                  onClick={() => setVideoMode('edit')}
                >
                  <Film size={14} />
                  {t('composer.video.edit')}
                </button>
              )}
            </div>
          )}

          {isMusicComposer ? (
            <div className="composer-mode-tabs composer-mode-tabs-2">
              <button type="button" className="active">
                {t('composer.music.create')}
              </button>
            </div>
          ) : isEditView ? (
            <div className="composer-mode-tabs composer-mode-tabs-2">
              <button type="button" className="active">
                {t('composer.tab.single')}
              </button>
            </div>
          ) : isTwoTabComposer ? (
            <div className="composer-mode-tabs composer-mode-tabs-2">
              <button
                type="button"
                className={composerMode === 'single' ? 'active' : ''}
                onClick={() => switchComposerMode('single')}
              >
                {t('composer.tab.single')}
              </button>
              <button
                type="button"
                className={composerMode === 'auto' ? 'active' : ''}
                onClick={() => switchComposerMode('auto')}
              >
                <Sparkles size={13} />
                {t('composer.tab.auto')}
              </button>
            </div>
          ) : (
            <div className="composer-mode-tabs composer-mode-tabs-4">
              <button
                type="button"
                className={composerMode === 'single' ? 'active' : ''}
                onClick={() => switchComposerMode('single')}
              >
                {t('composer.tab.single')}
              </button>
              <button
                type="button"
                className={composerMode === 'multi' ? 'active' : ''}
                onClick={() => switchComposerMode('multi')}
              >
                {t('composer.tab.multi')}
              </button>
              <button
                type="button"
                className={composerMode === 'auto' ? 'active' : ''}
                onClick={() => switchComposerMode('auto')}
              >
                {t('composer.tab.auto')}
              </button>
              <button
                type="button"
                className={composerMode === 'ai' ? 'active' : ''}
                onClick={() => switchComposerMode('ai')}
              >
                <Bot size={13} />
                {t('composer.tab.ai')}
              </button>
            </div>
          )}

          {isVideoAgentView ? (
            <>
              <div className="composer-field composer-agent-model">
                <div className="composer-label-row">
                  <span className="composer-label">{t('composer.model')}</span>
                </div>
                <ModelPicker
                  models={pickerModels}
                  value={selectedSlug}
                  onChange={setSelectedSlug}
                  loading={loadingModels}
                  motionPricing={isMotionView}
                  selectionMode={selections.mode || ''}
                  selectionResolution={selections.resolution || ''}
                />
              </div>

              <ComposerVideoAgentChat
                maxShots={multiShotConfig.maxShots}
                scriptCount={scriptCount}
                disabled={submitting}
                onScriptParsed={handleAgentScript}
              />
            </>
          ) : (
          <>
          <div className="composer-field">
            <div className="composer-label-row">
              <span className="composer-label">{t('composer.model')}</span>
              {composerMode === 'multi' && (
                <span className="composer-ref-count">{selectedSlugs.length} đã chọn</span>
              )}
            </div>
            <ModelPicker
              models={pickerModels}
              value={selectedSlug}
              onChange={(slug) => {
                setSelectedSlug(slug);
                if (composerMode === 'multi') {
                  setSelectedSlugs((prev) =>
                    prev.includes(slug) ? prev : [...prev, slug],
                  );
                }
              }}
              loading={loadingModels}
              multi={composerMode === 'multi'}
              multiValues={selectedSlugs}
              onMultiChange={setSelectedSlugs}
              motionPricing={isMotionView}
              selectionMode={selections.mode || ''}
              selectionResolution={selections.resolution || ''}
            />
          </div>

          {schema &&
            (schema.fields.ratio ||
              schema.fields.mode ||
              schema.fields.resolution ||
              schema.fields.duration) && (
            <div className="composer-selectors">
              {schema.fields.ratio && (
                <div className="composer-mini-field">
                  <span className="composer-label">{t('composer.ratio')}</span>
                  <OptionDropdown
                    icon={<Proportions size={14} />}
                    options={schema.options.ratios}
                    value={selections.ratio || ''}
                    onChange={(v) => updateSelection('ratio', v)}
                  />
                </div>
              )}
              {schema.fields.mode && (
                <div className="composer-mini-field">
                  <span className="composer-label">{t('composer.mode')}</span>
                  <OptionDropdown
                    icon={<SlidersHorizontal size={14} />}
                    options={schema.options.modes}
                    value={selections.mode || ''}
                    onChange={(v) => updateSelection('mode', v)}
                  />
                </div>
              )}
              {schema.fields.resolution && (
                <div className="composer-mini-field">
                  <span className="composer-label">{t('composer.resolution')}</span>
                  <OptionDropdown
                    icon={<Monitor size={14} />}
                    options={schema.options.resolutions}
                    value={selections.resolution || ''}
                    onChange={(v) => updateSelection('resolution', v)}
                  />
                </div>
              )}
              {schema.fields.duration && (
                <div className="composer-mini-field">
                  <span className="composer-label">{t('composer.duration')}</span>
                  <OptionDropdown
                    icon={<Clock size={14} />}
                    options={schema.options.durations}
                    value={selections.duration || ''}
                    onChange={(v) => updateSelection('duration', v)}
                  />
                </div>
              )}
            </div>
          )}

          {isMotionView && (
            <div className="composer-motion">
              <div className="composer-motion-grid">
                <div className="composer-motion-box">
                  <span className="composer-label">{t('composer.characterImage')}</span>
                  <ComposerMediaSlot
                    kind="image"
                    value={selections.images?.[0]}
                    onFile={(file) => ingestMediaFile(file, 'motionChar')}
                    onUrl={(url) => ingestMediaUrl(url, 'motionChar')}
                    emptyIcon={<PersonStanding size={18} />}
                    emptyTitle="Tải ảnh nhân vật"
                    emptyHint="JPG / PNG, ≥ 1K"
                  />
                </div>

                <div className="composer-motion-box">
                  <span className="composer-label">{t('composer.refVideo')}</span>
                  <ComposerMediaSlot
                    kind="video"
                    value={motionVideoUrl}
                    onFile={(file) => ingestMediaFile(file, 'motionVideo')}
                    onUrl={(url) => ingestMediaUrl(url, 'motionVideo')}
                    emptyIcon={<Video size={18} />}
                    emptyTitle="Tải video động tác"
                    emptyHint="≤ 30s / 50MB, 720p"
                  />
                </div>
              </div>

              {modelSelectNotices(currentModel).length > 0 && (
                <ul className="composer-motion-notices">
                  {modelSelectNotices(currentModel).map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {isEditView && (
            <div className="composer-edit">
              <span className="composer-label">{t('composer.editVideo')}</span>
              <ComposerMediaSlot
                kind="video"
                value={editVideoUrl}
                className="composer-edit-drop"
                previewClassName="composer-edit-preview"
                onFile={(file) => ingestMediaFile(file, 'editVideo')}
                onUrl={(url) => ingestMediaUrl(url, 'editVideo')}
                emptyIcon={<Film size={18} />}
                emptyTitle="Tải video nguồn"
                emptyHint="MP4 / WebM"
              />
              <p className="composer-mp-hint">Mô tả thay đổi bạn muốn (prompt) ở ô bên dưới.</p>
            </div>
          )}

          {!isMotionView && !isEditView && (hasFrame || hasComponent) && (
            <div className="composer-inputs">
              {showInputTabs && (
                <div className="composer-input-tabs">
                  <button
                    type="button"
                    className={inputView === 'frame' ? 'active' : ''}
                    onClick={() => switchInputMode('frame')}
                  >
                    Từ Ảnh Frame
                  </button>
                  <button
                    type="button"
                    className={inputView === 'component' ? 'active' : ''}
                    onClick={() => switchInputMode('component')}
                  >
                    Từ Thành Phần
                  </button>
                </div>
              )}

              {inputView === 'frame' && (
                <div className="composer-frame-grid">
                  <div className="composer-motion-box">
                    <span className="composer-label">{t('composer.frameStart')}</span>
                    <ComposerMediaSlot
                      kind="image"
                      value={selections.images?.[0]}
                      onFile={(file) => ingestMediaFile(file, 'frameStart')}
                      onUrl={(url) => ingestMediaUrl(url, 'frameStart')}
                      emptyIcon={<Plus size={18} />}
                      emptyTitle="Tự chọn"
                    />
                  </div>

                  {schema?.fields.endFrame && (
                    <div className="composer-motion-box">
                      <span className="composer-label">{t('composer.frameEnd')}</span>
                      <ComposerMediaSlot
                        kind="image"
                        value={selections.images?.[1]}
                        onFile={(file) => ingestMediaFile(file, 'frameEnd')}
                        onUrl={(url) => ingestMediaUrl(url, 'frameEnd')}
                        emptyIcon={<Plus size={18} />}
                        emptyTitle="Tự chọn"
                      />
                    </div>
                  )}
                </div>
              )}

              {inputView === 'component' && (
                <>
                  <div className="composer-label-row composer-ref-row">
                    <span className="composer-label">
                      {componentKey === 'references'
                        ? t('composer.references')
                        : t('composer.subject')}
                    </span>
                    <span className="composer-ref-count">
                      {componentKey === 'references' ? (
                        <>
                          {refLimits.image > 0 && (
                            <span title="Ảnh tham chiếu">
                              {componentImageCount}/{refLimits.image}
                            </span>
                          )}
                          {refLimits.video > 0 && (
                            <span title="Video tham chiếu">
                              {refLimits.image > 0 ? ' ' : ''}
                              {componentVideoCount}/{refLimits.video}
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          {componentList.length}/{maxComponents}
                        </>
                      )}
                    </span>
                  </div>

                  {canAddComponentAny && (
                    <div
                      className={`composer-addmedia ${componentDragOver ? 'drag' : ''}`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setComponentDragOver(true);
                      }}
                      onDragLeave={() => setComponentDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setComponentDragOver(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) void ingestMediaFile(file, 'component');
                      }}
                    >
                      <div className="composer-addmedia-btns">
                        {canAddComponentImage && (
                          <ComposerMediaPickButton
                            kind="image"
                            className="composer-addmedia-btn"
                            title="Thêm ảnh"
                            onFile={(file) => ingestMediaFile(file, 'component')}
                            onUrl={(url) => ingestMediaUrl(url, 'component')}
                          >
                            <ImageIcon size={18} />
                          </ComposerMediaPickButton>
                        )}
                        {canAddComponentVideo && (
                          <ComposerMediaPickButton
                            kind="video"
                            className="composer-addmedia-btn"
                            title="Thêm video"
                            onFile={(file) => ingestMediaFile(file, 'component')}
                            onUrl={(url) => ingestMediaUrl(url, 'component')}
                          >
                            <Video size={18} />
                          </ComposerMediaPickButton>
                        )}
                      </div>
                      <span className="composer-addmedia-text">{t('composer.addMedia')}</span>
                      <span className="composer-dropzone-hint">{t('composer.addMediaHint')}</span>
                    </div>
                  )}

                  {componentList.length > 0 && (
                    <div className="composer-mp-refgrid">
                      {componentList.map((url, i) => (
                        <div key={`${url}-${i}`} className="composer-mp-refthumb">
                          {urlMediaKind(url) === 'video' ? (
                            <video src={url} muted loop playsInline />
                          ) : urlMediaKind(url) === 'audio' ? (
                            <span className="composer-ref-audio">
                              <Video size={16} />
                            </span>
                          ) : (
                            <img src={url} alt={`tham chiếu ${i + 1}`} />
                          )}
                          <button type="button" onClick={() => removeComponent(i)}>
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {schema?.fields.text && (
            <div className="composer-field">
              <div className="composer-label-row">
                <span className="composer-label">{t('composer.tts')}</span>
                <div className="composer-desc-tools">
                  <button type="button" aria-label="Xóa" onClick={() => updateSelection('text', '')}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <textarea
                className="composer-textarea"
                rows={4}
                placeholder="Nhập văn bản cần chuyển thành giọng nói…"
                value={selections.text || ''}
                onChange={(e) => updateSelection('text', e.target.value)}
              />
            </div>
          )}

          {schema?.fields.musicName && (
            <div className="composer-field">
              <span className="composer-label">{t('composer.songName')}</span>
              <input
                className="composer-select"
                placeholder={t('composer.songNamePlaceholder')}
                value={selections.name || ''}
                onChange={(e) => updateSelection('name', e.target.value)}
              />
            </div>
          )}

          {composerMode === 'ai' && schema?.fields.prompt && (
            <div className="composer-ai-panel">
              <div className="composer-label-row">
                <span className="composer-label">{t('composer.aiIdea')}</span>
                <button
                  type="button"
                  className="composer-enhance"
                  disabled={enhancingPrompt}
                  onClick={() => void generateAiPrompt()}
                >
                  <Sparkles size={13} />
                  {enhancingPrompt ? t('composer.aiGenerating') : t('composer.aiGenerate')}
                </button>
              </div>
              <textarea
                className="composer-textarea"
                rows={3}
                placeholder={t('composer.aiBriefPlaceholder')}
                value={aiBrief}
                onChange={(e) => setAiBrief(e.target.value)}
              />
              <p className="composer-mp-hint">
                {canUseComposerPromptAi()
                  ? t('composer.aiHintLoggedIn')
                  : t('composer.aiHintGuest')}
              </p>
            </div>
          )}

          {composerMode === 'auto' && !isMotionView && !isEditView && (jobType === 'image' || jobType === 'video') && (
            <div className="composer-multiprompt">
              <label className="composer-switch-row">
                <span className="composer-switch-text">
                  <Sparkles size={14} />
                  <span>
                    <strong>{t('composer.multiPrompt.title')}</strong>
                    <small>{t('composer.multiPrompt.desc')}</small>
                  </span>
                </span>
                <span className={`composer-switch ${multiPrompt ? 'on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={multiPrompt}
                    onChange={(e) => setMultiPrompt(e.target.checked)}
                  />
                  <span className="composer-switch-knob" />
                </span>
              </label>

              {multiPrompt && (
                <div className="composer-multiprompt-body">
                  <div className="composer-mp-field">
                    <span className="composer-label">{t('composer.multiPrompt.separator')}</span>
                    <div className="composer-segment">
                      {['=====', '###', '---', '@@@'].map((sep) => (
                        <button
                          key={sep}
                          type="button"
                          className={promptSeparator === sep ? 'active' : ''}
                          onClick={() => setPromptSeparator(sep)}
                        >
                          {sep}
                        </button>
                      ))}
                    </div>
                  </div>

                  <p className="composer-mp-hint">
                    {t('composer.multiPrompt.hint', {
                      sep: promptSeparator,
                      type: typeLabel().toLowerCase(),
                    })}
                  </p>

                  <label className="composer-switch-row">
                    <span className="composer-switch-text">
                      <span>
                        <strong>{t('composer.perPromptRef.title')}</strong>
                        <small>{t('composer.perPromptRef.desc')}</small>
                      </span>
                    </span>
                    <span className={`composer-switch ${perPromptRef ? 'on' : ''}`}>
                      <input
                        type="checkbox"
                        checked={perPromptRef}
                        onChange={(e) => setPerPromptRef(e.target.checked)}
                      />
                      <span className="composer-switch-knob" />
                    </span>
                  </label>

                  {perPromptRef && (
                    <>
                      <div className="composer-mp-field">
                        <span className="composer-label">{t('composer.refSelect.label')}</span>
                        <div className="composer-segment">
                          {([
                            ['fixed', t('composer.refSelect.fixed')],
                            ['sequential', t('composer.refSelect.sequential')],
                            ['random', t('composer.refSelect.random')],
                          ] as const).map(([val, label]) => (
                            <button
                              key={val}
                              type="button"
                              className={refSelectMode === val ? 'active' : ''}
                              onClick={() => setRefSelectMode(val)}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="composer-mp-field">
                        <div className="composer-label-row">
                          <span className="composer-label">
                            {t('composer.refImages', { count: multiRefs.length })}
                          </span>
                          <ComposerMediaPickButton
                            kind="image"
                            className="composer-mp-addref"
                            multiple
                            onFile={async (f) => {
                              const rules = getUploadRules(currentModel, 'referenceImage');
                              const err = await validateMediaFile(f, rules, 'image');
                              if (err) {
                                setError(err);
                                return;
                              }
                              const url = await handleUpload(f, 'image');
                              if (url) setMultiRefs((prev) => [...prev, url]);
                            }}
                            onUrl={(url) => {
                              const err = validateMediaUrl(url, 'image');
                              if (err) {
                                setError(err);
                                return;
                              }
                              setError('');
                              setMultiRefs((prev) => [...prev, url.trim()]);
                            }}
                          >
                            <Plus size={13} /> {t('composer.addImage')}
                          </ComposerMediaPickButton>
                        </div>
                        <div className="composer-mp-refgrid">
                          {multiRefs.map((url, i) => (
                            <div key={`${url}-${i}`} className="composer-mp-refthumb">
                              <img src={url} alt={`ref ${i + 1}`} />
                              <button
                                type="button"
                                aria-label="Xóa ảnh"
                                onClick={() =>
                                  setMultiRefs((prev) => prev.filter((_, idx) => idx !== i))
                                }
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  <div className="composer-mp-field">
                    <div className="composer-label-row">
                      <span className="composer-label">{t('composer.concurrency.label')}</span>
                      <div className="composer-qty">
                        <button
                          type="button"
                          onClick={() => setConcurrencyLimit((n) => Math.max(1, n - 1))}
                        >
                          −
                        </button>
                        <span>{concurrencyLimit}</span>
                        <button
                          type="button"
                          onClick={() => setConcurrencyLimit((n) => Math.min(8, n + 1))}
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <p className="composer-mp-hint">{t('composer.concurrency.hint')}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {schema?.fields.multiShots && !isMotionView && !isEditView && (
            <div className="composer-multishot">
              <label className="composer-switch-row">
                <span className="composer-switch-text">
                  <Clapperboard size={14} />
                  <span>
                    <strong>{t('composer.multiShot.title')}</strong>
                    <small>
                      {t('composer.multiShot.desc', {
                        min: multiShotConfig.minShots,
                        max: multiShotConfig.maxShots,
                      })}
                    </small>
                  </span>
                </span>
                <span className={`composer-switch ${multiShotEnabled ? 'on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={multiShotEnabled}
                    onChange={(e) => enableMultiShot(e.target.checked)}
                  />
                  <span className="composer-switch-knob" />
                </span>
              </label>

              {multiShotEnabled && (
                <div className="composer-shots-panel">
                  <div className="composer-label-row">
                    <span className="composer-label">{t('composer.shots.label')}</span>
                    <div className="composer-shots-tools">
                      <button
                        type="button"
                        className="composer-enhance"
                        disabled={enhancingPrompt}
                        onClick={() => void generateShotsFromBrief()}
                      >
                        <Sparkles size={13} />
                        {enhancingPrompt
                          ? t('composer.shots.generating')
                          : t('composer.shots.generate')}
                      </button>
                      {(selections.shots || []).length < multiShotConfig.maxShots && (
                        <button type="button" className="composer-shot-add" onClick={addShotRow}>
                          <Plus size={14} /> {t('composer.shots.add')}
                        </button>
                      )}
                    </div>
                  </div>
                  {(selections.shots || []).map((shot, i) => (
                    <div key={shot.id} className="composer-shot-row">
                      <span className="composer-shot-index">
                        {t('composer.shot.index', { n: i + 1 })}
                      </span>
                      <textarea
                        className="composer-textarea composer-shot-input"
                        rows={2}
                        placeholder={t('composer.shot.placeholder')}
                        value={shot.prompt}
                        onChange={(e) => updateShot(shot.id, { prompt: e.target.value })}
                      />
                      {(selections.shots || []).length > multiShotConfig.minShots && (
                        <button
                          type="button"
                          className="composer-shot-remove"
                          aria-label="Xóa cảnh"
                          onClick={() => removeShotRow(shot.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {schema?.fields.prompt && !(multiShotEnabled && schema.fields.multiShots) && (
            <div className="composer-field">
              <div className="composer-label-row">
                <span className="composer-label composer-prompt-label">
                  {composerMode === 'ai' || (multiShotEnabled && schema.fields.multiShots) ? (
                    <>
                      <span className="composer-prompt-bar" />
                      PROMPT
                      <span className="composer-script-badge">
                        {t('composer.promptBadge', { count: scriptCount })}
                      </span>
                    </>
                  ) : schema.fields.musicName ? (
                    t('composer.musicStyle')
                  ) : (
                    t('composer.prompt')
                  )}
                </span>
                <div className="composer-desc-tools">
                  <button
                    type="button"
                    aria-label={t('composer.clearPrompt')}
                    onClick={() => updateSelection('prompt', '')}
                  >
                    <Trash2 size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label={t('composer.paste')}
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText();
                        if (text) updateSelection('prompt', text);
                      } catch {
                        /* ignore */
                      }
                    }}
                  >
                    <Clipboard size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label={t('composer.expand')}
                    onClick={() => setPromptModalOpen(true)}
                  >
                    <Maximize2 size={14} />
                  </button>
                  <button
                    type="button"
                    className="composer-enhance"
                    disabled={enhancingPrompt}
                    onClick={() => void enhanceCurrentPrompt()}
                  >
                    <Sparkles size={13} />
                    {enhancingPrompt ? 'Đang nâng cao…' : 'Nâng cao'}
                  </button>
                </div>
              </div>
              <textarea
                className="composer-textarea"
                rows={multiPrompt && composerMode === 'auto' ? 6 : 4}
                placeholder={
                  multiPrompt && composerMode === 'auto'
                    ? 'Prompt 1\n=====\nPrompt 2\n=====\nPrompt 3'
                    : schema.fields.musicName
                      ? 'Mô tả phong cách nhạc…'
                      : 'Mô tả nội dung của bạn…'
                }
                value={selections.prompt || ''}
                onChange={(e) => updateSelection('prompt', e.target.value)}
              />
            </div>
          )}

          {schema?.fields.prompt && !isMusicComposer && (
            <label className="composer-switch-row composer-normalize">
              <span className="composer-switch-text">
                <Wand2 size={14} />
                <span>
                  <strong>{t('composer.normalize')}</strong>
                  <small>
                    {canUseComposerPromptAi()
                      ? 'Tự động chuẩn hóa prompt bằng AI trước khi tạo.'
                      : 'Gộp khoảng trắng thừa (đăng nhập Gommo token để dùng AI).'}
                  </small>
                </span>
              </span>
              <span className={`composer-switch ${normalizePrompt ? 'on' : ''}`}>
                <input
                  type="checkbox"
                  checked={normalizePrompt}
                  onChange={(e) => toggleNormalizePrompt(e.target.checked)}
                />
                <span className="composer-switch-knob" />
              </span>
            </label>
          )}
          </>
          )}

          {isMotionView && (
            <div className="composer-motion-breakdown">
              <span className="composer-motion-breakdown-formula">
                {t('composer.motion.formula', { count: scriptCount })}{' '}
                {motionDurationLoading
                  ? '…'
                  : motionBilledSeconds > 0
                    ? motionBilledSeconds
                    : '—'}
              </span>
              {motionPromoPercent > 0 && (
                <span className="composer-motion-promo">-{motionPromoPercent}%</span>
              )}
              <span className="composer-motion-breakdown-prices">
                {motionGrossTotal > 0 && motionPromoPercent > 0 && (
                  <span className="composer-motion-gross">
                    {motionGrossTotal.toLocaleString('vi-VN')}
                  </span>
                )}
                <span className="composer-motion-breakdown-total">
                  {motionTotalCost > 0
                    ? motionTotalCost.toLocaleString('vi-VN')
                    : motionRatePerSec > 0
                      ? '—'
                      : '0'}
                </span>
              </span>
              {motionVideoUrl && !motionDurationLoading && motionVideoDuration <= 0 && (
                <p className="composer-mp-hint">Không đọc được thời lượng video — giá tổng có thể sai.</p>
              )}
              {!motionVideoUrl && motionRatePerSec > 0 && (
                <p className="composer-mp-hint">
                  Giá model: {motionRatePerSec.toLocaleString('vi-VN')}/s — tải video tham chiếu để tính tổng.
                </p>
              )}
            </div>
          )}

          <div className="composer-cost">
            <span className="composer-coin">
              <Sparkles size={13} />
              {isMotionView ? (
                <>
                  {motionRatePerSec > 0 ? `${motionRatePerSec.toLocaleString('vi-VN')}/s` : '0'}
                </>
              ) : (
                composerMode === 'multi' ? submitTotalCost : composerCost || 0
              )}
            </span>
            {!isMotionView && !isEditView && !isMusicComposer && composerMode !== 'multi' && (
              <div className="composer-qty">
                <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
                <span>{qty}</span>
                <button type="button" onClick={() => setQty((q) => Math.min(8, q + 1))}>+</button>
              </div>
            )}
            <span className="composer-total">
              <Sparkles size={13} />{' '}
              {isMotionView
                ? motionTotalCost > 0
                  ? submitTotalCost.toLocaleString('vi-VN')
                  : motionGrossTotal > 0 && motionPromoPercent > 0
                    ? motionGrossTotal.toLocaleString('vi-VN')
                    : '—'
                : submitTotalCost}
            </span>
          </div>

          {error && <p className="error composer-error">{error}</p>}
          {progress && <p className="progress composer-progress">{progress}</p>}

          <button
            type="button"
            className="composer-submit"
            disabled={submitting || !schema}
            onClick={(e) => void handleSubmit(e as unknown as FormEvent)}
          >
            <Wand2 size={16} />
            {submitting
              ? t('composer.submitting')
              : t('composer.submit', { type: typeLabel() })}
          </button>
        </aside>

        <div
          className="composer-resizer"
          onPointerDown={startResize}
          role="separator"
          aria-orientation="vertical"
          aria-label={t('composer.resizer')}
        />

        <section className="composer-main">
          <div className="composer-toolbar">
            <div className="composer-toolbar-tabs">
              {([
                ['current', t('composer.gallery.current')],
                ['history', t('composer.gallery.history')],
                ['folder', t('composer.gallery.folder')],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={mainTab === key ? 'active' : ''}
                  onClick={() => setMainTab(key)}
                >
                  {label}
                </button>
              ))}
              <span className="composer-toolbar-count">
                {t('composer.gallery.files', { count: toolbarCount })}
              </span>
              {selectionCount === 0 && selectableIds.length > 0 && (
                <button
                  type="button"
                  className="composer-select-all-link"
                  onClick={toggleSelectAll}
                >
                  {t('composer.gallery.selectAllCount', {
                    count: selectableIds.length,
                    type: typeLabel().toLowerCase(),
                  })}
                </button>
              )}
            </div>
            <div className="composer-toolbar-right">
              {selectionCount > 0 && (
                <div className="composer-toolbar-actions">
                  {jobType === 'image' && (
                    <button
                      type="button"
                      className="composer-toolbar-action"
                      onClick={() => {
                        switchJobType('video');
                        clearSelection();
                      }}
                    >
                      <Clapperboard size={14} />
                      {t('composer.createVideoAuto')} ({selectionCount})
                    </button>
                  )}
                  <button
                    type="button"
                    className="composer-toolbar-action"
                    onClick={downloadSelected}
                  >
                    <Download size={14} />
                    Download ({selectionCount})
                  </button>
                  <button
                    type="button"
                    className="composer-toolbar-action danger"
                    onClick={deleteSelected}
                  >
                    <Trash2 size={14} />
                    Xóa ({selectionCount})
                  </button>
                  <button
                    type="button"
                    className="composer-toolbar-action ghost"
                    onClick={clearSelection}
                  >
                    {t('composer.action.clearSelection')}
                  </button>
                </div>
              )}
              <label className="composer-zoom">
                <input
                  type="range"
                  min={160}
                  max={320}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                />
              </label>
            </div>
          </div>

          {mainTab === 'history' ? (
            <ComposerHistory
              jobType={jobType}
              zoom={zoom}
              pendingJobs={pendingJobs}
              refreshKey={historyTick}
              onItemDeleted={handleFeedItemDeleted}
              onCountChange={setHistoryCount}
              onVisibleIdsChange={setHistoryVisibleIds}
              onUrlMapChange={setHistoryUrlMap}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onClearSelection={clearSelection}
            />
          ) : mainTab === 'folder' ? (
            <ComposerLibrary
              jobType={jobType}
              zoom={zoom}
              refreshKey={historyTick}
              onCountChange={setLibraryCount}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onVisibleIdsChange={setLibraryVisibleIds}
              onUrlMapChange={setLibraryUrlMap}
              onItemDeleted={handleFeedItemDeleted}
              buildPreviewHandlers={buildPreviewHandlers}
            />
          ) : displayedResults.length === 0 && !(mainTab === 'current' && pendingJobs.length > 0) ? (
            <p className="muted composer-empty">
              {t('composer.gallery.empty', { type: typeLabel() })}
            </p>
          ) : (
            <div className={useClibLayout ? 'clib-wrap' : 'composer-results'}>
              {mainTab === 'current' && pendingJobs.length > 0 && (
                <section className={useClibLayout ? 'clib-group' : 'composer-day-group'}>
                  {useClibLayout ? (
                    <header className="clib-group-head">
                      <span className="clib-group-label">Đang tạo</span>
                      <span className="clib-count">({pendingJobs.length})</span>
                    </header>
                  ) : (
                    <h3 className="composer-day">Đang tạo</h3>
                  )}
                  <div
                    className={useClibLayout ? 'clib-grid' : 'composer-grid'}
                    style={
                      useClibLayout
                        ? { ['--clib-thumb' as string]: `${zoom}px` }
                        : { ['--thumb' as string]: `${zoom}px` }
                    }
                  >
                    {pendingJobs.map((p) => (
                      <article
                        key={p.id}
                        className={`hist-card hist-card-pending-vmedia ${p.status}`}
                      >
                        <div className="pending-vmedia-body">
                          {p.status === 'processing' ? (
                            <>
                              <span className="pending-spinner-lg" aria-hidden />
                              <span className="pending-vmedia-label">ĐANG TẠO</span>
                              <div
                                className="pending-vmedia-bar"
                                role="progressbar"
                                aria-valuenow={p.progress ?? 12}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-label="Tiến độ tạo"
                              >
                                <div
                                  className="pending-vmedia-bar-fill"
                                  style={{ width: `${p.progress ?? 12}%` }}
                                />
                              </div>
                            </>
                          ) : (
                            <>
                              <span className="pending-failed-icon-lg">!</span>
                              <span className="pending-vmedia-label failed">THẤT BẠI</span>
                            </>
                          )}
                        </div>
                        {p.prompt ? (
                          <p className="pending-vmedia-prompt" title={p.prompt}>
                            {p.prompt}
                          </p>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </section>
              )}
              {groupedResults.map(([day, entries]) => (
                <section key={day} className={useClibLayout ? 'clib-group' : 'composer-day-group'}>
                  {useClibLayout ? (
                    <header className="clib-group-head">
                      <span className="clib-group-label">{day}</span>
                      <span className="clib-count">({entries.length})</span>
                    </header>
                  ) : (
                    <h3 className="composer-day">{day}</h3>
                  )}
                  <div
                    className={useClibLayout ? 'clib-grid' : 'composer-grid'}
                    style={
                      useClibLayout
                        ? { ['--clib-thumb' as string]: `${zoom}px` }
                        : { ['--thumb' as string]: `${zoom}px` }
                    }
                  >
                    {entries.map((entry) => {
                      if (useClibLayout && isClibHistoryEntry(entry, jobType)) {
                        const feedItem = historyEntryToFeedItem(entry);
                        const flatIndex = currentPreviewIndexById.get(entry.id) ?? 0;
                        return (
                          <ComposerLibraryItem
                            key={entry.id}
                            item={feedItem}
                            kind={historyComposerMediaKind(jobType)}
                            selected={selectedIds.has(entry.id)}
                            onToggleSelect={() => toggleSelect(entry.id)}
                            onPreview={() => setCurrentPreviewIndex(flatIndex)}
                            onDelete={() => handleCurrentDelete(entry)}
                            deleting={currentDeletingId === entry.id}
                            extraMenuItems={[
                              {
                                label: 'Dùng lại',
                                icon: <Clipboard size={14} />,
                                onClick: () => applyReuse(entry),
                              },
                            ]}
                          />
                        );
                      }

                      const kind = isMediaUrl(entry.resultUrl, entry.type);
                      const selected = selectedIds.has(entry.id);
                      return (
                        <article
                          key={entry.id}
                          className={`hist-card ${selected ? 'selected' : ''}`}
                        >
                          <div className="hist-card-thumb-wrap">
                            <ComposerSelectCircle
                              selected={selected}
                              onToggle={() => toggleSelect(entry.id)}
                            />
                            <a
                              className="hist-card-thumb"
                              href={entry.resultUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {kind === 'image' && (
                                <img src={entry.resultUrl} alt="" loading="lazy" />
                              )}
                              {kind === 'video' && (
                                <video src={entry.resultUrl} muted playsInline preload="metadata" />
                              )}
                              {kind === 'audio' && <span className="hist-card-icon">🔊</span>}
                              {kind === 'file' && <span className="hist-card-icon">📄</span>}
                            </a>
                            <div className="hist-card-overlay">
                              <button type="button" onClick={() => applyReuse(entry)}>
                                Dùng lại
                              </button>
                              <a href={entry.resultUrl} target="_blank" rel="noreferrer" download>
                                Tải
                              </a>
                              <button
                                type="button"
                                className="danger"
                                onClick={() => removeHistoryEntry(entry.id)}
                              >
                                Xóa
                              </button>
                            </div>
                          </div>
                          <div className="hist-card-body">
                            <p className="hist-card-prompt" title={entry.prompt}>
                              {entry.prompt || '—'}
                            </p>
                            <p className="hist-card-meta">
                              {entry.modelName || entry.modelSlug || '—'}
                              {' · '}
                              {new Date(entry.createdAt).toLocaleTimeString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}

              {useClibLayout && currentPreviewIndex != null && currentPreviewItems.length > 0 && (
                <ComposerLibraryPreviewModal
                  items={currentPreviewItems}
                  index={Math.min(currentPreviewIndex, currentPreviewItems.length - 1)}
                  kind={historyComposerMediaKind(jobType)}
                  onClose={() => setCurrentPreviewIndex(null)}
                  onNavigate={setCurrentPreviewIndex}
                  handlers={buildPreviewHandlers(
                    currentPreviewItems[
                      Math.min(currentPreviewIndex, currentPreviewItems.length - 1)
                    ],
                    feedMediaUrl(currentPreviewItems[
                      Math.min(currentPreviewIndex, currentPreviewItems.length - 1)
                    ]) ||
                      feedThumb(currentPreviewItems[
                        Math.min(currentPreviewIndex, currentPreviewItems.length - 1)
                      ]) ||
                      '',
                    () => setCurrentPreviewIndex(null),
                    () => {
                      const item = currentPreviewItems[currentPreviewIndex];
                      const entry = displayedResults.find((e) => e.id === item?.id_base);
                      if (entry) handleCurrentDelete(entry);
                    },
                  )}
                  deleting={Boolean(
                    currentPreviewItems[currentPreviewIndex]?.id_base &&
                      currentDeletingId === currentPreviewItems[currentPreviewIndex]?.id_base,
                  )}
                />
              )}
            </div>
          )}
        </section>

        {promptModalOpen &&
          createPortal(
            <div className="composer-prompt-modal" role="dialog" aria-modal="true">
              <button
                type="button"
                className="composer-prompt-modal-backdrop"
                aria-label="Đóng"
                onClick={() => setPromptModalOpen(false)}
              />
              <div className="composer-prompt-modal-panel">
                <div className="composer-prompt-modal-head">
                  <span>Mô tả</span>
                  <button type="button" onClick={() => setPromptModalOpen(false)}>
                    ×
                  </button>
                </div>
                <textarea
                  className="composer-textarea composer-prompt-modal-text"
                  rows={14}
                  value={selections.prompt || ''}
                  onChange={(e) => updateSelection('prompt', e.target.value)}
                />
              </div>
            </div>,
            document.body,
          )}
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <p className="kicker">AI Studio</p>
        <h1>{t('composer.create', { type: typeLabel() })}</h1>
        <p className="lead">
          Gọi thẳng <strong>v2.api.gommo.net</strong> — credit upstream:{' '}
          <strong>{credits.toLocaleString('vi-VN')}</strong>
          {unitCost > 0 && <> · Chi phí ~{unitCost} credit</>}
        </p>
      </div>

      {!lockType && (
        <div className="type-tabs studio-type-tabs">
          {STUDIO_JOB_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              className={`tab ${jobType === t.value ? 'active' : ''}`}
              onClick={() => switchJobType(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="pg-grid studio-grid">
        <section className="panel">
          <div className="panel-head">
            <h2>Models</h2>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => loadModelsList(jobType)}
              disabled={loadingModels}
            >
              Refresh
            </button>
          </div>
          {loadingModels && <p className="muted">Đang tải…</p>}
          <ul className="model-list">
            {models.map((m) => {
              const slug = modelSlug(m);
              return (
                <li key={slug}>
                  <button
                    type="button"
                    className={`model-item ${selectedSlug === slug ? 'selected' : ''}`}
                    onClick={() => setSelectedSlug(slug)}
                  >
                    <span className="model-name">{m.name || slug}</span>
                    <span className="model-slug">{slug}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="panel">
          <h2>Tạo job</h2>
          {!schema ? (
            <p className="muted">Chọn model.</p>
          ) : (
            <form onSubmit={handleSubmit} className="form">
              {schema.fields.prompt && (
                <label className="field">
                  <span className="label">Prompt</span>
                  <textarea
                    rows={3}
                    value={selections.prompt || ''}
                    onChange={(e) => updateSelection('prompt', e.target.value)}
                  />
                </label>
              )}
              {schema.fields.text && (
                <label className="field">
                  <span className="label">Text (TTS)</span>
                  <textarea
                    rows={3}
                    value={selections.text || ''}
                    onChange={(e) => updateSelection('text', e.target.value)}
                  />
                </label>
              )}
              {schema.fields.musicName && (
                <label className="field">
                  <span className="label">Tên bài (music)</span>
                  <input
                    value={selections.name || ''}
                    onChange={(e) => updateSelection('name', e.target.value)}
                  />
                </label>
              )}
              {schema.fields.ratio && (
                <label className="field">
                  <span className="label">Ratio</span>
                  <select
                    value={selections.ratio || ''}
                    onChange={(e) => updateSelection('ratio', e.target.value)}
                  >
                    {schema.options.ratios.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
              )}
              {schema.fields.mode && (
                <label className="field">
                  <span className="label">Mode</span>
                  <select
                    value={selections.mode || ''}
                    onChange={(e) => updateSelection('mode', e.target.value)}
                  >
                    {schema.options.modes.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
              )}
              {schema.fields.resolution && (
                <label className="field">
                  <span className="label">Resolution</span>
                  <select
                    value={selections.resolution || ''}
                    onChange={(e) => updateSelection('resolution', e.target.value)}
                  >
                    {schema.options.resolutions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
              )}
              {schema.fields.duration && (
                <label className="field">
                  <span className="label">Duration</span>
                  <select
                    value={selections.duration || ''}
                    onChange={(e) => updateSelection('duration', e.target.value)}
                  >
                    {schema.options.durations.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
              )}
              {schema.fields.startFrame && (
                <UrlField
                  label={schema.fields.endFrame ? 'Start frame URL' : 'First frame URL'}
                  value={selections.images?.[0] || ''}
                  onChange={(v) => updateUrlList('images', 0, v)}
                  onUpload={async (f) => {
                    const uploaded = await handleUpload(f, 'image');
                    if (uploaded) updateUrlList('images', 0, uploaded);
                  }}
                />
              )}
              {schema.fields.endFrame && (
                <UrlField
                  label="End frame URL"
                  value={selections.images?.[1] || ''}
                  onChange={(v) => updateUrlList('images', 1, v)}
                  onUpload={async (f) => {
                    const uploaded = await handleUpload(f, 'image');
                    if (uploaded) updateUrlList('images', 1, uploaded);
                  }}
                />
              )}
              {schema.fields.references && (
                <UrlField
                  label={`Reference URL (max ${schema.limits.maxReference})`}
                  value={selections.references?.[0] || ''}
                  onChange={(v) => updateUrlList('references', 0, v)}
                  onUpload={async (f) => {
                    const uploaded = await handleUpload(f, 'image');
                    if (uploaded) updateUrlList('references', 0, uploaded);
                  }}
                />
              )}
              {schema.fields.subjects && (
                <UrlField
                  label={`Subject URL (max ${schema.limits.maxSubject})`}
                  value={selections.subjects?.[0] || ''}
                  onChange={(v) => updateUrlList('subjects', 0, v)}
                  onUpload={async (f) => {
                    const uploaded = await handleUpload(f, 'image');
                    if (uploaded) updateUrlList('subjects', 0, uploaded);
                  }}
                />
              )}
              <div className="actions">
                <button type="submit" className="btn primary btn-job" disabled={submitting}>
                  {submitting
                    ? t('composer.submitting')
                    : t('composer.submit', { type: typeLabel() })}
                </button>
                {submitting && (
                  <button type="button" className="btn secondary" onClick={() => abortRef.current?.abort()}>
                    Hủy poll
                  </button>
                )}
              </div>
            </form>
          )}

          {processingJobs.length > 0 && (
            <p className="progress muted" style={{ marginTop: '0.75rem' }}>
              Đang xử lý: {processingJobs.map((j) => j.model_id).join(', ')}
            </p>
          )}

          {error && <p className="error">{error}</p>}
          {progress && <p className="progress">{progress}</p>}

          {resultUrl && (
            <div className="result-preview">
              <h3>Kết quả</h3>
              <a href={resultUrl} target="_blank" rel="noreferrer">{resultUrl}</a>
              {/\.(png|jpe?g|webp|gif)/i.test(resultUrl) && (
                <img src={resultUrl} alt="result" />
              )}
              {/\.(mp4|webm|mov)/i.test(resultUrl) && (
                <video src={resultUrl} controls />
              )}
              {/\.(mp3|wav|ogg|m4a)/i.test(resultUrl) && (
                <audio src={resultUrl} controls />
              )}
            </div>
          )}
        </section>

        <StudioGallery
          jobType={jobType}
          sessionItems={sessionItems}
          onReuse={applyReuse}
        />
      </div>
    </div>
  );
}
