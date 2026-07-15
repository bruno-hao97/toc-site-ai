import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Check } from 'lucide-react';
import type { GommoModel, JobType } from '../../services/api';
import {
  analyzeModel,
  defaultSelections,
  modelSlug,
  type ModelOption,
  type ModelSchema,
} from '../../services/modelSchema';
import { AI_GEN_PORTS, type AiGenPortKind } from '../../services/workflowAiGenPorts';
import { fetchModelsForType, pickDefaultModel } from '../../services/workflowEngine';
import { WfNodePortsGrid } from './WfNodePortsGrid';
import {
  formatCreditBadge,
  formatGenLoadingCopy,
  formatGenTimer,
  resolveWorkflowModelPrice,
} from '../../services/workflowModelPricing';

type WFStatus = 'idle' | 'running' | 'done' | 'error';

export interface AiGenNodeData {
  modelId?: string;
  prompt?: string;
  ratio?: string;
  mode?: string;
  resolution?: string;
  duration?: string;
  status?: WFStatus;
  statusText?: string;
  resultUrl?: string;
  error?: string;
  runStartedAt?: number;
  runEndedAt?: number;
  [key: string]: unknown;
}

interface AiGenNodeCardProps {
  type: AiGenPortKind;
  data: AiGenNodeData;
  update: (patch: Partial<AiGenNodeData>) => void;
  portsExpanded: boolean;
  head: ReactNode;
  placeholder: string;
  nodeId: string;
  onOpenResultPreview?: (nodeId: string, kind: 'image' | 'video') => void;
}

function ratioToAspect(ratio?: string): string | undefined {
  if (!ratio) return undefined;
  const m = ratio.match(/^(\d+)\s*[:/]\s*(\d+)$/);
  if (!m) return undefined;
  return `${m[1]} / ${m[2]}`;
}

function ConfigPill({
  label,
  value,
  options,
  onChange,
  readOnly,
}: {
  label: string;
  value?: string;
  options: ModelOption[];
  onChange?: (v: string) => void;
  readOnly?: boolean;
}) {
  if (!value && options.length === 0) return null;
  const display = options.find((o) => o.value === value)?.label || value || label;
  const short =
    display.length > 10 && display.includes(' ')
      ? display.split(/\s+/)[0]
      : display.length > 14
        ? `${display.slice(0, 12)}…`
        : display;

  if (readOnly || !onChange || options.length === 0) {
    return <span className="wf-gen-pill wf-gen-pill--readonly">{short}</span>;
  }

  return (
    <select
      className="wf-gen-pill wf-gen-pill--select nodrag"
      value={value || ''}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function GenPreview({
  type,
  resultUrl,
  status,
  statusText,
  ratio,
  configFooter,
  runningFooter,
  onOpenPreview,
}: {
  type: 'image' | 'video';
  resultUrl?: string;
  status?: WFStatus;
  statusText?: string;
  ratio?: string;
  configFooter?: ReactNode;
  runningFooter?: ReactNode;
  onOpenPreview?: () => void;
}) {
  const aspect = ratioToAspect(ratio);
  const running = status === 'running';
  const done = status === 'done';
  const showArea = Boolean(resultUrl) || running;

  if (!showArea) return null;

  const loading = formatGenLoadingCopy(statusText);
  const isVideo =
    type === 'video' ||
    (resultUrl && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(resultUrl));

  const clickable = done && Boolean(resultUrl) && Boolean(onOpenPreview);

  return (
    <div
      className={`wf-gen-preview${done ? ' wf-gen-preview--done' : ''}${running ? ' wf-gen-preview--running' : ''}${clickable ? ' wf-gen-preview--clickable' : ''}`}
      style={aspect ? { aspectRatio: aspect } : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      title={clickable ? 'Xem kết quả' : undefined}
      onClick={
        clickable
          ? (e) => {
              e.stopPropagation();
              onOpenPreview?.();
            }
          : undefined
      }
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onOpenPreview?.();
              }
            }
          : undefined
      }
    >
      {resultUrl &&
        (isVideo ? (
          <video className="wf-gen-preview-media" src={resultUrl} muted preload="metadata" />
        ) : (
          <img className="wf-gen-preview-media" src={resultUrl} alt="" />
        ))}
      {running && !resultUrl && <div className="wf-gen-preview-placeholder" aria-hidden />}
      {running && (
        <div className="wf-gen-loading-overlay">
          <div className="wf-gen-loading-spinner" />
          <p className="wf-gen-loading-primary">{loading.primary}</p>
          <p className="wf-gen-loading-secondary">{loading.secondary}</p>
        </div>
      )}
      {running && runningFooter && (
        <div
          className="wf-gen-preview-run-footer"
          onClick={(e) => e.stopPropagation()}
        >
          {runningFooter}
        </div>
      )}
      {done && configFooter && <div className="wf-gen-preview-footer">{configFooter}</div>}
    </div>
  );
}

export function AiGenNodeCard({
  type,
  data,
  update,
  portsExpanded,
  head,
  placeholder,
  nodeId,
  onOpenResultPreview,
}: AiGenNodeCardProps) {
  const jobType: JobType = type;
  const ports = AI_GEN_PORTS[type];
  const [models, setModels] = useState<GommoModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let on = true;
    setLoadingModels(true);
    fetchModelsForType(jobType)
      .then((m) => {
        if (!on) return;
        setModels(m);
        if (!data.modelId) {
          const def = pickDefaultModel(m);
          if (def) {
            const slug = modelSlug(def);
            const schema = analyzeModel(def, jobType);
            const defs = defaultSelections(schema);
            update({
              modelId: slug,
              ratio: data.ratio || defs.ratio,
              mode: data.mode || defs.mode,
              resolution: data.resolution || defs.resolution,
              duration: data.duration || defs.duration,
            });
          }
        }
      })
      .catch(() => {})
      .finally(() => on && setLoadingModels(false));
    return () => {
      on = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobType]);

  const currentModel = useMemo(
    () => models.find((m) => modelSlug(m) === data.modelId) ?? null,
    [models, data.modelId],
  );

  const schema: ModelSchema | null = useMemo(
    () => (currentModel ? analyzeModel(currentModel, jobType) : null),
    [currentModel, jobType],
  );

  useEffect(() => {
    if (!schema) return;
    const defs = defaultSelections(schema);
    const patch: Partial<AiGenNodeData> = {};
    if (!data.ratio && defs.ratio) patch.ratio = defs.ratio;
    if (!data.mode && defs.mode) patch.mode = defs.mode;
    if (!data.resolution && defs.resolution) patch.resolution = defs.resolution;
    if (!data.duration && defs.duration) patch.duration = defs.duration;
    if (Object.keys(patch).length) update(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema?.slug]);

  const creditCost = useMemo(
    () => resolveWorkflowModelPrice(currentModel, data.mode || '', data.resolution || ''),
    [currentModel, data.mode, data.resolution],
  );
  const creditBadge = formatCreditBadge(creditCost);

  const hasRef = Boolean(schema?.fields.references && currentModel?.withReference);
  const running = data.status === 'running';
  const done = data.status === 'done';
  const editing = !running && !done;

  useEffect(() => {
    if (!running && !done) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [running, done]);

  const timerLabel = useMemo(() => {
    const start = data.runStartedAt;
    if (!start) return '';
    const end = done && data.runEndedAt ? data.runEndedAt : now;
    return formatGenTimer(end - start);
  }, [data.runStartedAt, data.runEndedAt, done, now]);

  const modelName = currentModel?.name || data.modelId || (loadingModels ? 'Đang tải…' : 'Chọn model');

  const configPills = useCallback(
    (readOnly: boolean) => (
      <>
        {schema?.options.ratios.length ? (
          <ConfigPill
            label="Tỉ lệ"
            value={data.ratio}
            options={schema.options.ratios}
            readOnly={readOnly}
            onChange={(v) => update({ ratio: v })}
          />
        ) : null}
        {schema?.options.resolutions.length ? (
          <ConfigPill
            label="Phân giải"
            value={data.resolution}
            options={schema.options.resolutions}
            readOnly={readOnly}
            onChange={(v) => update({ resolution: v })}
          />
        ) : null}
        {schema?.options.modes.length ? (
          <ConfigPill
            label="Chế độ"
            value={data.mode}
            options={schema.options.modes}
            readOnly={readOnly}
            onChange={(v) => update({ mode: v })}
          />
        ) : null}
        {schema?.options.durations.length ? (
          <ConfigPill
            label="Thời lượng"
            value={data.duration}
            options={schema.options.durations}
            readOnly={readOnly}
            onChange={(v) => update({ duration: v })}
          />
        ) : null}
        {hasRef ? <span className="wf-gen-pill wf-gen-pill--readonly">Ref</span> : null}
      </>
    ),
    [schema, data.ratio, data.resolution, data.mode, data.duration, hasRef, update],
  );

  const footerPills = useMemo(
    () => (
      <div className="wf-gen-footer-pills">
        <span className="wf-gen-pill wf-gen-pill--model">{modelName}</span>
        {configPills(true)}
        <span className="wf-gen-done-check" aria-hidden>
          <Check size={12} />
        </span>
      </div>
    ),
    [modelName, configPills],
  );

  const { cancelWorkflow, workflowRunning } = useWorkflowGenControls();

  return (
    <div
      className={`wf-node wf-gen-node status-${data.status || 'idle'}${portsExpanded ? ' wf-node--ports-expanded' : ''}`}
    >
      {head}
      <WfNodePortsGrid ports={ports} expanded={portsExpanded} />

      <div className="wf-gen-body nodrag">
        <div className="wf-gen-head-meta">
          {creditBadge && !done ? <span className="wf-gen-credit">{creditBadge}</span> : null}
          {timerLabel ? (
            <span className={`wf-gen-timer${done ? ' wf-gen-timer--done' : ''}`}>{timerLabel}</span>
          ) : null}
        </div>

        {!done && (
          <div className="wf-gen-model-block">
            {running ? (
              <div className="wf-gen-model-name">{modelName}</div>
            ) : (
              <select
                className="wf-gen-model-select nodrag"
                value={data.modelId || ''}
                disabled={loadingModels}
                onChange={(e) => {
                  const slug = e.target.value;
                  const m = models.find((x) => modelSlug(x) === slug);
                  if (!m) {
                    update({ modelId: slug });
                    return;
                  }
                  const s = analyzeModel(m, jobType);
                  const defs = defaultSelections(s);
                  update({
                    modelId: slug,
                    ratio: defs.ratio,
                    mode: defs.mode,
                    resolution: defs.resolution,
                    duration: defs.duration,
                  });
                }}
              >
                {loadingModels && <option value="">Đang tải model…</option>}
                {!loadingModels && models.length === 0 && <option value="">Không có model</option>}
                {models.map((m) => {
                  const slug = modelSlug(m);
                  return (
                    <option key={slug} value={slug}>
                      {m.name || slug}
                    </option>
                  );
                })}
              </select>
            )}
            <div className="wf-gen-config-pills">{configPills(running)}</div>
          </div>
        )}

        {editing && (
          <textarea
            className="wf-gen-prompt nodrag"
            value={data.prompt || ''}
            placeholder={placeholder}
            onChange={(e) => update({ prompt: e.target.value })}
          />
        )}

        {(running || done) && data.prompt?.trim() && (
          <div className="wf-gen-prompt-snippet" title={data.prompt}>
            {data.prompt.trim().slice(0, 80)}
            {data.prompt.trim().length > 80 ? '…' : ''}
          </div>
        )}

        <GenPreview
          type={type}
          resultUrl={data.resultUrl}
          status={data.status}
          statusText={data.statusText}
          ratio={data.ratio}
          onOpenPreview={
            onOpenResultPreview
              ? () => onOpenResultPreview(nodeId, type === 'video' ? 'video' : 'image')
              : undefined
          }
          configFooter={done ? footerPills : undefined}
          runningFooter={
            running ? (
              <>
                <span className="wf-gen-progress">0/1 {type === 'image' ? 'image' : 'video'}</span>
                {workflowRunning && cancelWorkflow && (
                  <button type="button" className="wf-gen-cancel nodrag" onClick={cancelWorkflow}>
                    Hủy tác vụ
                  </button>
                )}
              </>
            ) : undefined
          }
        />

        {data.error && <p className="wf-node-error">{data.error}</p>}
      </div>
    </div>
  );
}

const GenControlsCtx = createContext<{
  cancelWorkflow?: () => void;
  workflowRunning: boolean;
}>({ workflowRunning: false });

export function AiGenControlsProvider({
  children,
  cancelWorkflow,
  workflowRunning,
}: {
  children: ReactNode;
  cancelWorkflow?: () => void;
  workflowRunning: boolean;
}) {
  const value = useMemo(
    () => ({ cancelWorkflow, workflowRunning }),
    [cancelWorkflow, workflowRunning],
  );
  return <GenControlsCtx.Provider value={value}>{children}</GenControlsCtx.Provider>;
}

export function useWorkflowGenControls() {
  return useContext(GenControlsCtx);
}
