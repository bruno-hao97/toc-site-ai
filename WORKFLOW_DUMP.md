# Workflow / Node System Dump

Generated: 2026-07-07 15:32:34

## File index

- `src/pages/WorkflowPage.tsx` (1878 lines)
- `src/services/workflowAgentActions.ts` (938 lines)
- `src/components/workflow/WorkflowMediaInputModal.tsx` (494 lines)
- `src/components/workflow/WorkflowAgentPanel.tsx` (416 lines)
- `src/components/WorkflowLibrary.tsx` (364 lines)
- `src/services/workflowAgentStore.ts` (236 lines)
- `src/services/workflowLibraryStore.ts` (214 lines)
- `src/services/wflImport.ts` (173 lines)
- `src/services/workflowMediaInput.ts` (153 lines)
- `src/components/WorkflowTopBar.tsx` (132 lines)
- `src/services/workflowTabsStore.ts` (104 lines)
- `src/services/workflowEngine.ts` (76 lines)
- `src/services/workflowStore.ts` (45 lines)
- `src/components/workflow/WorkflowAgentSettingsModal.tsx` (167 lines)
- `src/components/workflow/WorkflowAgentChatSettingsModal.tsx` (55 lines)

---

## src/pages/WorkflowPage.tsx

```tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type DragEvent,
  type ReactNode,
} from 'react';
import {
  addEdge,
  BaseEdge,
  Background,
  EdgeLabelRenderer,
  getBezierPath,
  Handle,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useStore,
  type Connection,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  ArrowUpCircle,
  Bell,
  Bot,
  Captions,
  ChevronDown,
  Combine,
  Copy,
  Database,
  Download,
  Eraser,
  Film,
  Flag,
  GitBranch,
  Globe,
  Image,
  LayoutGrid,
  Loader2,
  Maximize,
  Music,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Repeat,
  Scissors,
  Search,
  Sparkles,
  Square,
  StickyNote,
  Timer,
  Trash2,
  Type,
  Users,
  Video,
  Volume2,
  Wand2,
  Workflow,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { GommoModel, JobType } from '../services/api';
import { fetchModelsForType, pickDefaultModel, runNodeJob } from '../services/workflowEngine';
import { modelSlug } from '../services/modelSchema';
import type { JobSelections } from '../services/modelSchema';
import { clearWorkflow, saveWorkflow } from '../services/workflowStore';
import WorkflowLibrary from '../components/WorkflowLibrary';
import WorkflowTopBar from '../components/WorkflowTopBar';
import WorkflowAgentPanel from '../components/workflow/WorkflowAgentPanel';
import WorkflowMediaInputModal from '../components/workflow/WorkflowMediaInputModal';
import {
  loadTemplates,
  onLibraryUpdated,
  saveTemplate,
  type SavedTemplate,
} from '../services/workflowLibraryStore';
import {
  loadTabsState,
  makeTab,
  saveTabsState,
  type WorkflowTab,
} from '../services/workflowTabsStore';
import ProjectPicker from '../components/ProjectPicker';
import type { ProjectItemType } from '../services/projectStore';
import {
  defaultMediaInputDraft,
  draftFromNodeData,
  extractVideoFirstFrame,
  MEDIA_INPUT_PORTS,
  resolveMediaInputUrls,
  type MediaInputDraft,
  type MediaInputKind,
} from '../services/workflowMediaInput';

type WFStatus = 'idle' | 'running' | 'done' | 'error';

interface NodeData {
  modelId?: string;
  prompt?: string;
  text?: string;
  url?: string;
  method?: string;
  seconds?: number;
  count?: number;
  op?: string;
  compare?: string;
  status?: WFStatus;
  statusText?: string;
  resultUrl?: string;
  fileName?: string;
  error?: string;
  [key: string]: unknown;
}

type WFNode = Node<NodeData>;

interface WorkflowCtxValue {
  updateNode: (id: string, patch: Partial<NodeData>) => void;
  openMediaInputModal: (nodeId: string) => void;
}

const WorkflowCtx = createContext<WorkflowCtxValue>({
  updateNode: () => {},
  openMediaInputModal: () => {},
});

function useUpdateNode(id: string) {
  const { updateNode } = useContext(WorkflowCtx);
  return useCallback((patch: Partial<NodeData>) => updateNode(id, patch), [id, updateNode]);
}

function guessProjectType(url: string): ProjectItemType {
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)) return 'video';
  if (/\.(mp3|wav|ogg|m4a)(\?|$)/i.test(url)) return 'tts';
  return 'image';
}

function StatusDot({ status }: { status?: WFStatus }) {
  if (status === 'running') return <Loader2 size={14} className="wf-spin" />;
  return <span className={`wf-dot wf-dot-${status || 'idle'}`} />;
}

function useDeleteNode(id: string) {
  const { deleteElements } = useReactFlow();
  return useCallback(() => {
    deleteElements({ nodes: [{ id }] });
  }, [deleteElements, id]);
}

function NodeHead({
  id,
  icon,
  title,
  status,
  showStatus = true,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  status?: WFStatus;
  showStatus?: boolean;
}) {
  const del = useDeleteNode(id);
  return (
    <div className="wf-node-head">
      <span className="wf-node-title">
        {icon} {title}
      </span>
      <span className="wf-node-head-right">
        {showStatus && <StatusDot status={status} />}
        <button type="button" className="wf-node-del nodrag" title="Xóa node" onClick={del}>
          <X size={13} />
        </button>
      </span>
    </div>
  );
}

function Port({
  side,
  label,
  color,
  handleId,
}: {
  side: 'in' | 'out';
  label: string;
  color?: string;
  handleId?: string;
}) {
  return (
    <div className={`wf-port wf-port--${side}`}>
      <Handle
        type={side === 'in' ? 'target' : 'source'}
        position={side === 'in' ? Position.Left : Position.Right}
        id={handleId}
        className="wf-handle"
        style={color ? { background: color, borderColor: color } : undefined}
      />
      <span className="wf-port-label">{label}</span>
    </div>
  );
}

function Preview({ url }: { url: string }) {
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)) {
    return <video className="wf-node-preview" src={url} controls preload="metadata" />;
  }
  if (/\.(mp3|wav|ogg|m4a)(\?|$)/i.test(url)) {
    return <audio className="wf-node-audio" src={url} controls />;
  }
  return <img className="wf-node-preview" src={url} alt="" />;
}

function ModelSelect({
  type,
  value,
  onChange,
}: {
  type: JobType;
  value?: string;
  onChange: (v: string) => void;
}) {
  const [models, setModels] = useState<GommoModel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    setLoading(true);
    fetchModelsForType(type)
      .then((m) => {
        if (!on) return;
        setModels(m);
        if (!value) {
          const def = pickDefaultModel(m);
          if (def) onChange(modelSlug(def));
        }
      })
      .catch(() => {})
      .finally(() => on && setLoading(false));
    return () => {
      on = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  return (
    <select
      className="wf-node-select nodrag"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
    >
      {loading && <option value="">Đang tải model…</option>}
      {!loading && models.length === 0 && <option value="">Không có model</option>}
      {models.map((m) => {
        const slug = modelSlug(m);
        return (
          <option key={slug} value={slug}>
            {m.name || slug}
          </option>
        );
      })}
    </select>
  );
}

function TextNode({ id, data }: NodeProps<WFNode>) {
  const update = useUpdateNode(id);
  return (
    <div className={`wf-node status-${data.status || 'idle'}`}>
      <NodeHead id={id} icon={<Type size={14} />} title="Nhập text" status={data.status} />
      <textarea
        className="wf-node-input nodrag"
        value={data.prompt || ''}
        placeholder="Nhập mô tả / prompt…"
        onChange={(e) => update({ prompt: e.target.value })}
      />
      <Port side="out" label="Văn bản" />
    </div>
  );
}

function CompactMediaInputNode({
  id,
  data,
  kind,
}: NodeProps<WFNode> & { kind: MediaInputKind }) {
  const { openMediaInputModal } = useContext(WorkflowCtx);
  const ports = MEDIA_INPUT_PORTS[kind];
  const title = kind === 'image' ? 'Nhập ảnh' : 'Nhập Video';
  const Icon = kind === 'image' ? Image : Video;
  const count = Array.isArray(data.mediaUrls) ? data.mediaUrls.length : 0;

  return (
    <div
      className={`wf-node wf-node-media-compact status-${data.status || 'idle'}`}
      onDoubleClick={() => openMediaInputModal(id)}
      title="Double-click để chỉnh sửa"
    >
      <NodeHead id={id} icon={<Icon size={14} />} title={title} status={data.status} />
      {count > 0 && (
        <p className="wf-node-media-count">
          {count} {kind === 'image' ? 'ảnh' : 'video'}
        </p>
      )}
      <div className="wf-node-media-ports">
        {ports.in.map((p) => (
          <Port key={p.id} side="in" label={p.label} color={p.color} handleId={p.id} />
        ))}
        {ports.out.map((p) => (
          <Port key={p.id} side="out" label={p.label} color={p.color} handleId={p.id} />
        ))}
      </div>
    </div>
  );
}

function InputImageNode(props: NodeProps<WFNode>) {
  return <CompactMediaInputNode {...props} kind="image" />;
}

function InputVideoNode(props: NodeProps<WFNode>) {
  return <CompactMediaInputNode {...props} kind="video" />;
}

function ImageNode({ id, data }: NodeProps<WFNode>) {
  const update = useUpdateNode(id);
  return (
    <div className={`wf-node status-${data.status || 'idle'}`}>
      <NodeHead id={id} icon={<Image size={14} />} title="Tạo ảnh" status={data.status} />
      <Port side="in" label="Văn bản" />
      <ModelSelect type="image" value={data.modelId} onChange={(v) => update({ modelId: v })} />
      <textarea
        className="wf-node-input nodrag"
        value={data.prompt || ''}
        placeholder="Prompt (bỏ trống nếu nối từ node text)"
        onChange={(e) => update({ prompt: e.target.value })}
      />
      {data.resultUrl && <Preview url={data.resultUrl} />}
      {data.statusText && <p className="wf-node-status">{data.statusText}</p>}
      {data.error && <p className="wf-node-error">{data.error}</p>}
      <Port side="out" label="URL Ảnh" />
    </div>
  );
}

function VideoNode({ id, data }: NodeProps<WFNode>) {
  const update = useUpdateNode(id);
  return (
    <div className={`wf-node status-${data.status || 'idle'}`}>
      <NodeHead id={id} icon={<Video size={14} />} title="Tạo video" status={data.status} />
      <Port side="in" label="Văn bản / Ảnh" />
      <ModelSelect type="video" value={data.modelId} onChange={(v) => update({ modelId: v })} />
      <textarea
        className="wf-node-input nodrag"
        value={data.prompt || ''}
        placeholder="Prompt mô tả chuyển động"
        onChange={(e) => update({ prompt: e.target.value })}
      />
      {data.resultUrl && <Preview url={data.resultUrl} />}
      {data.statusText && <p className="wf-node-status">{data.statusText}</p>}
      {data.error && <p className="wf-node-error">{data.error}</p>}
      <Port side="out" label="URL Video" />
    </div>
  );
}

function TtsNode({ id, data }: NodeProps<WFNode>) {
  const update = useUpdateNode(id);
  return (
    <div className={`wf-node status-${data.status || 'idle'}`}>
      <NodeHead id={id} icon={<Volume2 size={14} />} title="Đọc giọng" status={data.status} />
      <Port side="in" label="Văn bản" />
      <ModelSelect type="tts" value={data.modelId} onChange={(v) => update({ modelId: v })} />
      <textarea
        className="wf-node-input nodrag"
        value={data.text || ''}
        placeholder="Văn bản (bỏ trống nếu nối từ node text)"
        onChange={(e) => update({ text: e.target.value })}
      />
      {data.resultUrl && <Preview url={data.resultUrl} />}
      {data.statusText && <p className="wf-node-status">{data.statusText}</p>}
      {data.error && <p className="wf-node-error">{data.error}</p>}
      <Port side="out" label="URL Âm thanh" />
    </div>
  );
}

function MusicNode({ id, data }: NodeProps<WFNode>) {
  const update = useUpdateNode(id);
  return (
    <div className={`wf-node status-${data.status || 'idle'}`}>
      <NodeHead id={id} icon={<Music size={14} />} title="Tạo nhạc AI" status={data.status} />
      <Port side="in" label="Văn bản" />
      <ModelSelect type="music" value={data.modelId} onChange={(v) => update({ modelId: v })} />
      <textarea
        className="wf-node-input nodrag"
        value={data.prompt || ''}
        placeholder="Mô tả bản nhạc (hoặc nối từ node text)"
        onChange={(e) => update({ prompt: e.target.value })}
      />
      {data.resultUrl && <Preview url={data.resultUrl} />}
      {data.statusText && <p className="wf-node-status">{data.statusText}</p>}
      {data.error && <p className="wf-node-error">{data.error}</p>}
      <Port side="out" label="URL Nhạc" />
    </div>
  );
}

function NoteNode({ id, data }: NodeProps<WFNode>) {
  const update = useUpdateNode(id);
  return (
    <div className="wf-node wf-node-note">
      <NodeHead id={id} icon={<StickyNote size={14} />} title="Ghi chú" showStatus={false} />
      <textarea
        className="wf-node-input nodrag"
        value={data.prompt || ''}
        placeholder="Ghi chú…"
        onChange={(e) => update({ prompt: e.target.value })}
      />
    </div>
  );
}

function OutputNode({ id, data }: NodeProps<WFNode>) {
  return (
    <div className={`wf-node wf-node-output status-${data.status || 'idle'}`}>
      <NodeHead id={id} icon={<Package size={14} />} title="Kết quả" status={data.status} />
      <Port side="in" label="Kết quả" />
      {data.resultUrl ? (
        <>
          <Preview url={data.resultUrl} />
          <div className="wf-node-out-actions">
            <a className="wf-node-link nodrag" href={data.resultUrl} target="_blank" rel="noreferrer">
              Mở
            </a>
            <ProjectPicker
              snapshot={{
                itemId: data.resultUrl,
                type: guessProjectType(data.resultUrl),
                prompt: 'Từ workflow',
                thumbnailUrl: data.resultUrl,
                downloadUrl: data.resultUrl,
              }}
            />
          </div>
        </>
      ) : (
        <p className="wf-node-empty">Chạy quy trình để nhận kết quả.</p>
      )}
      {data.error && <p className="wf-node-error">{data.error}</p>}
      <Port side="out" label="Đầu ra" />
    </div>
  );
}

function StartNode({ id, data }: NodeProps<WFNode>) {
  return (
    <div className={`wf-node wf-node-start status-${data.status || 'idle'}`}>
      <NodeHead id={id} icon={<Play size={14} />} title="Bắt đầu" status={data.status} />
      <p className="wf-node-empty">Điểm khởi động quy trình.</p>
      <Port side="out" label="Bắt đầu" color="#fbbf24" />
    </div>
  );
}

function EndNode({ id, data }: NodeProps<WFNode>) {
  return (
    <div className={`wf-node wf-node-end status-${data.status || 'idle'}`}>
      <NodeHead id={id} icon={<Flag size={14} />} title="Kết thúc" status={data.status} />
      <Port side="in" label="Kết thúc" color="#fbbf24" />
      <p className="wf-node-empty">
        {data.status === 'done' ? 'Quy trình hoàn tất.' : 'Điểm kết thúc quy trình.'}
      </p>
    </div>
  );
}

function RenderNode({ id, data }: NodeProps<WFNode>) {
  return (
    <div className={`wf-node status-${data.status || 'idle'}`}>
      <NodeHead id={id} icon={<Film size={14} />} title="Render Video" status={data.status} />
      <Port side="in" label="Video" color="#60a5fa" handleId="video" />
      <p className="wf-node-empty">
        Ghép các video đầu vào{data.exportMode ? ` · ${String(data.exportMode)}` : ''}
        {data.resolution ? ` · ${String(data.resolution)}` : ''}
      </p>
      {data.statusText && <p className="wf-node-status">{data.statusText}</p>}
      {data.error && <p className="wf-node-error">{data.error}</p>}
      <Port side="out" label="Video" color="#60a5fa" handleId="video" />
    </div>
  );
}

function ApiNode({ id, data }: NodeProps<WFNode>) {
  const update = useUpdateNode(id);
  return (
    <div className={`wf-node status-${data.status || 'idle'}`}>
      <NodeHead id={id} icon={<Globe size={14} />} title="Gọi API" status={data.status} />
      <Port side="in" label="Payload" />
      <div className="wf-node-row">
        <select
          className="wf-node-select wf-node-method nodrag"
          value={data.method || 'GET'}
          onChange={(e) => update({ method: e.target.value })}
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="PATCH">PATCH</option>
          <option value="DELETE">DELETE</option>
        </select>
      </div>
      <input
        className="wf-node-input wf-node-url nodrag"
        type="text"
        value={data.url || ''}
        placeholder="https://api.example.com/…"
        onChange={(e) => update({ url: e.target.value })}
      />
      <textarea
        className="wf-node-input nodrag"
        value={data.prompt || ''}
        placeholder="Body JSON (bỏ trống nếu nối từ node text)"
        onChange={(e) => update({ prompt: e.target.value })}
      />
      {data.statusText && <p className="wf-node-status">{data.statusText}</p>}
      {data.error && <p className="wf-node-error">{data.error}</p>}
      <Port side="out" label="Phản hồi" />
    </div>
  );
}

function ConditionNode({ id, data }: NodeProps<WFNode>) {
  const update = useUpdateNode(id);
  const op = data.op || 'not_empty';
  const needsCompare = op !== 'not_empty' && op !== 'empty';
  return (
    <div className={`wf-node wf-node-control status-${data.status || 'idle'}`}>
      <NodeHead id={id} icon={<GitBranch size={14} />} title="Điều kiện" status={data.status} />
      <Port side="in" label="Giá trị" />
      <div className="wf-node-row">
        <select
          className="wf-node-select nodrag"
          value={op}
          onChange={(e) => update({ op: e.target.value })}
        >
          <option value="not_empty">Không rỗng</option>
          <option value="empty">Rỗng</option>
          <option value="contains">Chứa</option>
          <option value="equals">Bằng</option>
          <option value="gt">Lớn hơn (số)</option>
          <option value="lt">Nhỏ hơn (số)</option>
        </select>
      </div>
      {needsCompare && (
        <input
          className="wf-node-input wf-node-url nodrag"
          type="text"
          value={data.compare || ''}
          placeholder="Giá trị so sánh"
          onChange={(e) => update({ compare: e.target.value })}
        />
      )}
      {data.statusText && <p className="wf-node-status">{data.statusText}</p>}
      <Port side="out" label="Đúng" color="#34d399" handleId="true" />
      <Port side="out" label="Sai" color="#f87171" handleId="false" />
    </div>
  );
}

function DelayNode({ id, data }: NodeProps<WFNode>) {
  const update = useUpdateNode(id);
  return (
    <div className={`wf-node wf-node-control status-${data.status || 'idle'}`}>
      <NodeHead id={id} icon={<Timer size={14} />} title="Trì hoãn" status={data.status} />
      <Port side="in" label="Kích hoạt" />
      <div className="wf-node-row wf-node-inline">
        <input
          className="wf-node-input wf-node-url nodrag"
          type="number"
          min={0}
          step={0.5}
          value={data.seconds ?? 1}
          onChange={(e) => update({ seconds: Number(e.target.value) })}
        />
        <span className="wf-node-suffix">giây</span>
      </div>
      {data.statusText && <p className="wf-node-status">{data.statusText}</p>}
      <Port side="out" label="Xong" />
    </div>
  );
}

function LoopNode({ id, data }: NodeProps<WFNode>) {
  const update = useUpdateNode(id);
  return (
    <div className={`wf-node wf-node-control status-${data.status || 'idle'}`}>
      <NodeHead id={id} icon={<Repeat size={14} />} title="Vòng lặp" status={data.status} />
      <Port side="in" label="Kích hoạt" />
      <div className="wf-node-row wf-node-inline">
        <span className="wf-node-suffix">Lặp</span>
        <input
          className="wf-node-input wf-node-url nodrag"
          type="number"
          min={1}
          step={1}
          value={data.count ?? 3}
          onChange={(e) => update({ count: Number(e.target.value) })}
        />
        <span className="wf-node-suffix">lần</span>
      </div>
      {data.statusText && <p className="wf-node-status">{data.statusText}</p>}
      <Port side="out" label="Mỗi vòng" color="#fbbf24" handleId="each" />
      <Port side="out" label="Hoàn tất" handleId="done" />
    </div>
  );
}

function CloneNode({ id, data }: NodeProps<WFNode>) {
  return (
    <div className={`wf-node wf-node-control status-${data.status || 'idle'}`}>
      <NodeHead id={id} icon={<Copy size={14} />} title="Nhân Bản" status={data.status} />
      <Port side="in" label="Đầu vào" />
      <p className="wf-node-empty">Sao chép dữ liệu sang nhiều nhánh.</p>
      <Port side="out" label="Bản sao" />
    </div>
  );
}

function NotifyNode({ id, data }: NodeProps<WFNode>) {
  const update = useUpdateNode(id);
  return (
    <div className={`wf-node wf-node-control status-${data.status || 'idle'}`}>
      <NodeHead id={id} icon={<Bell size={14} />} title="Gửi thông báo" status={data.status} />
      <Port side="in" label="Kích hoạt" />
      <textarea
        className="wf-node-input nodrag"
        value={data.prompt || ''}
        placeholder="Nội dung (bỏ trống để dùng dữ liệu nối vào)"
        onChange={(e) => update({ prompt: e.target.value })}
      />
      {data.statusText && <p className="wf-node-status">{data.statusText}</p>}
      <Port side="out" label="Xong" />
    </div>
  );
}

const nodeTypes = {
  start: StartNode,
  text: TextNode,
  'input-image': InputImageNode,
  'input-video': InputVideoNode,
  image: ImageNode,
  video: VideoNode,
  tts: TtsNode,
  music: MusicNode,
  api: ApiNode,
  condition: ConditionNode,
  delay: DelayNode,
  loop: LoopNode,
  clone: CloneNode,
  notify: NotifyNode,
  note: NoteNode,
  output: OutputNode,
  end: EndNode,
  render: RenderNode,
};

function WfEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  selected,
}: EdgeProps) {
  const { deleteElements } = useReactFlow();
  const [hovered, setHovered] = useState(false);
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const active = hovered || selected;
  return (
    <g onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        interactionWidth={26}
        style={{
          ...style,
          stroke: active ? 'var(--brand, #2dd4bf)' : (style?.stroke as string | undefined),
          strokeWidth: active ? 2.5 : (style?.strokeWidth as number | undefined),
        }}
      />
      <EdgeLabelRenderer>
        <button
          type="button"
          className="wf-edge-del nodrag nopan"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            opacity: active ? 1 : 0,
          }}
          title="Hủy nối"
          onClick={() => deleteElements({ edges: [{ id }] })}
        >
          <X size={11} />
        </button>
      </EdgeLabelRenderer>
    </g>
  );
}

const edgeTypes = { wf: WfEdge };

type IconType = ComponentType<{ size?: number }>;

interface NodeDef {
  key: string;
  label: string;
  icon: IconType;
  implemented: boolean;
}

interface NodeGroup {
  id: string;
  label: string;
  color: string;
  icon: IconType;
  defaultOpen?: boolean;
  nodes: NodeDef[];
}

const soon = (key: string, label: string, icon: IconType): NodeDef => ({
  key,
  label,
  icon,
  implemented: false,
});

const NODE_GROUPS: NodeGroup[] = [
  {
    id: 'frequent',
    label: 'Dùng thường xuyên',
    color: '#fbbf24',
    icon: Sparkles,
    defaultOpen: true,
    nodes: [
      { key: 'start', label: 'Bắt đầu', icon: Play, implemented: true },
      { key: 'api', label: 'Gọi API', icon: Globe, implemented: true },
      { key: 'end', label: 'Kết thúc', icon: Flag, implemented: true },
      { key: 'image', label: 'Tạo ảnh AI', icon: Image, implemented: true },
      soon('agent', 'Tác Nhân AI', Bot),
      { key: 'text', label: 'Nhập văn bản', icon: Type, implemented: true },
    ],
  },
  {
    id: 'control',
    label: 'Luồng điều khiển',
    color: '#a78bfa',
    icon: GitBranch,
    nodes: [
      { key: 'start', label: 'Bắt đầu', icon: Play, implemented: true },
      { key: 'end', label: 'Kết thúc', icon: Flag, implemented: true },
      { key: 'condition', label: 'Điều kiện', icon: GitBranch, implemented: true },
      { key: 'delay', label: 'Trì hoãn', icon: Timer, implemented: true },
      { key: 'loop', label: 'Vòng lặp', icon: Repeat, implemented: true },
      { key: 'clone', label: 'Nhân Bản', icon: Copy, implemented: true },
      { key: 'notify', label: 'Gửi thông báo', icon: Bell, implemented: true },
    ],
  },
  {
    id: 'content',
    label: 'Tạo nội dung AI',
    color: '#2dd4bf',
    icon: Sparkles,
    defaultOpen: true,
    nodes: [
      { key: 'image', label: 'Tạo ảnh AI', icon: Image, implemented: true },
      { key: 'video', label: 'Tạo video AI', icon: Video, implemented: true },
      { key: 'tts', label: 'Tạo giọng nói', icon: Volume2, implemented: true },
      { key: 'music', label: 'Tạo nhạc AI', icon: Music, implemented: true },
      soon('prompt', 'Tạo Prompt AI', Wand2),
      soon('storyboard', 'Storyboard', LayoutGrid),
    ],
  },
  {
    id: 'process',
    label: 'Xử lý',
    color: '#a78bfa',
    icon: Wand2,
    nodes: [
      { key: 'api', label: 'Gọi API', icon: Globe, implemented: true },
      soon('upscale-image', 'Nâng cấp ảnh', ArrowUpCircle),
      soon('upscale-video', 'Nâng cấp video', ArrowUpCircle),
      soon('remove-bg', 'Xóa nền ảnh', Eraser),
      soon('lipsync', 'Video khẩu hình', Video),
      soon('vfx', 'Tạo hiệu ứng video', Wand2),
      soon('subtitle', 'Subtitle', Captions),
      soon('render', 'Render Video', Film),
      soon('cut', 'Cắt Video', Scissors),
    ],
  },
  {
    id: 'io',
    label: 'Đầu vào / Đầu ra',
    color: '#34d399',
    icon: Package,
    nodes: [
      soon('agent', 'Tác Nhân AI', Bot),
      { key: 'text', label: 'Nhập văn bản', icon: Type, implemented: true },
      { key: 'input-image', label: 'Nhập ảnh', icon: Image, implemented: true },
      { key: 'input-video', label: 'Nhập Video', icon: Video, implemented: true },
      { key: 'output', label: 'Đầu ra', icon: Package, implemented: true },
      soon('merge', 'Gộp dữ liệu', Combine),
      { key: 'note', label: 'Ghi chú', icon: StickyNote, implemented: true },
      soon('data-table', 'Bảng dữ liệu', Database),
      soon('extract-media', 'Trích xuất Media', Download),
      soon('kols', 'KOLs', Users),
    ],
  },
];

function Palette({
  onAdd,
  open,
  onToggle,
}: {
  onAdd: (type: string) => void;
  open: boolean;
  onToggle: () => void;
}) {
  const [query, setQuery] = useState('');
  const [openMap, setOpenMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NODE_GROUPS.map((g) => [g.id, Boolean(g.defaultOpen)])),
  );
  const q = query.trim().toLowerCase();

  const onDragStart = (e: DragEvent, key: string) => {
    e.dataTransfer.setData('application/wf-node', key);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className={`wf-palette${open ? '' : ' collapsed'}`}>
      <div className="wf-palette-head">
        <span>CÁC NODE</span>
        <button
          type="button"
          className="wf-palette-toggle"
          onClick={onToggle}
          title="Thu gọn sidebar"
        >
          <PanelLeftClose size={16} />
        </button>
      </div>
      <div className="wf-palette-search">
        <Search size={14} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm node…"
        />
      </div>

      <div className="wf-palette-groups">
        {NODE_GROUPS.map((g) => {
          const nodes = q ? g.nodes.filter((n) => n.label.toLowerCase().includes(q)) : g.nodes;
          if (q && nodes.length === 0) return null;
          const open = q ? true : openMap[g.id];
          return (
            <section key={g.id} className="wf-group">
              <button
                type="button"
                className="wf-group-head"
                style={{ ['--g' as string]: g.color }}
                onClick={() => setOpenMap((m) => ({ ...m, [g.id]: !m[g.id] }))}
              >
                <span className="wf-group-icon">
                  <g.icon size={13} />
                </span>
                <span className="wf-group-name">{g.label}</span>
                <span className="wf-group-count">{g.nodes.length}</span>
                <ChevronDown size={14} className={`wf-group-caret${open ? ' open' : ''}`} />
              </button>
              {open && (
                <div className="wf-group-grid">
                  {nodes.map((n, i) => (
                    <button
                      key={`${g.id}-${n.key}-${i}`}
                      type="button"
                      className={`wf-tile${n.implemented ? '' : ' soon'}`}
                      draggable={n.implemented}
                      onDragStart={n.implemented ? (e) => onDragStart(e, n.key) : undefined}
                      onClick={n.implemented ? () => onAdd(n.key) : undefined}
                      disabled={!n.implemented}
                      title={n.implemented ? n.label : `${n.label} (Sắp có)`}
                    >
                      <n.icon size={20} />
                      <span className="wf-tile-label">{n.label}</span>
                      {!n.implemented && <span className="wf-tile-soon">Sắp có</span>}
                    </button>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <button type="button" className="wf-mini-app" disabled title="Sắp có">
        <LayoutGrid size={15} /> Tạo Mini App
      </button>
    </aside>
  );
}

function defaultGraph(): { nodes: WFNode[]; edges: Edge[] } {
  return {
    nodes: [
      { id: 'start-1', type: 'start', position: { x: 20, y: 140 }, data: {} },
      { id: 'text-1', type: 'text', position: { x: 250, y: 100 }, data: { prompt: '' } },
      { id: 'image-1', type: 'image', position: { x: 540, y: 80 }, data: {} },
      { id: 'output-1', type: 'output', position: { x: 850, y: 100 }, data: {} },
      { id: 'end-1', type: 'end', position: { x: 1140, y: 150 }, data: {} },
    ],
    edges: [
      { id: 'e0', source: 'start-1', target: 'text-1', type: 'wf' },
      { id: 'e1', source: 'text-1', target: 'image-1', type: 'wf' },
      { id: 'e2', source: 'image-1', target: 'output-1', type: 'wf' },
      { id: 'e3', source: 'output-1', target: 'end-1', type: 'wf' },
    ],
  };
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

/** Đánh giá điều kiện cho node Điều kiện. */
function evalCondition(value: string, op: string, compare?: string): boolean {
  const v = (value ?? '').trim();
  const c = (compare ?? '').trim();
  switch (op) {
    case 'empty':
      return v.length === 0;
    case 'contains':
      return v.toLowerCase().includes(c.toLowerCase());
    case 'equals':
      return v === c;
    case 'gt':
      return Number(v) > Number(c);
    case 'lt':
      return Number(v) < Number(c);
    case 'not_empty':
    default:
      return v.length > 0;
  }
}

/** Sắp xếp topo; trả null nếu có chu trình. */
function topoSort(nodes: WFNode[], edges: Edge[]): WFNode[] | null {
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  nodes.forEach((n) => {
    indeg.set(n.id, 0);
    adj.set(n.id, []);
  });
  edges.forEach((e) => {
    if (!indeg.has(e.source) || !indeg.has(e.target)) return;
    adj.get(e.source)!.push(e.target);
    indeg.set(e.target, (indeg.get(e.target) || 0) + 1);
  });
  const queue = nodes.filter((n) => (indeg.get(n.id) || 0) === 0).map((n) => n.id);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of adj.get(id) || []) {
      indeg.set(next, (indeg.get(next) || 0) - 1);
      if ((indeg.get(next) || 0) === 0) queue.push(next);
    }
  }
  if (order.length !== nodes.length) return null;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return order.map((id) => byId.get(id)!);
}

let nodeCounter = 100;

/** Tự dàn các node theo lớp (longest-path) — không cần thư viện ngoài. */
function autoLayout(nodes: WFNode[], edges: Edge[]): Record<string, { x: number; y: number }> {
  const adj = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  nodes.forEach((n) => {
    adj.set(n.id, []);
    indeg.set(n.id, 0);
  });
  edges.forEach((e) => {
    if (!adj.has(e.source) || !indeg.has(e.target)) return;
    adj.get(e.source)!.push(e.target);
    indeg.set(e.target, (indeg.get(e.target) || 0) + 1);
  });

  // Layer bằng longest-path qua thứ tự Kahn (an toàn cả khi có chu trình).
  const layer = new Map<string, number>();
  nodes.forEach((n) => layer.set(n.id, 0));
  const queue = nodes.filter((n) => (indeg.get(n.id) || 0) === 0).map((n) => n.id);
  const localIndeg = new Map(indeg);
  let processed = 0;
  while (queue.length) {
    const id = queue.shift()!;
    processed++;
    for (const next of adj.get(id) || []) {
      layer.set(next, Math.max(layer.get(next) || 0, (layer.get(id) || 0) + 1));
      localIndeg.set(next, (localIndeg.get(next) || 0) - 1);
      if ((localIndeg.get(next) || 0) === 0) queue.push(next);
    }
  }
  if (processed < nodes.length) {
    // Có chu trình: xếp node còn lại vào lớp cuối.
    const maxLayer = Math.max(0, ...Array.from(layer.values()));
    nodes.forEach((n) => {
      if ((localIndeg.get(n.id) || 0) > 0) layer.set(n.id, maxLayer + 1);
    });
  }

  const COL_W = 300;
  const ROW_H = 170;
  const X0 = 60;
  const Y0 = 60;
  const perLayer = new Map<number, number>();
  const pos: Record<string, { x: number; y: number }> = {};
  // Giữ thứ tự ổn định theo vị trí hiện tại.
  const ordered = [...nodes].sort((a, b) => a.position.y - b.position.y);
  for (const n of ordered) {
    const l = layer.get(n.id) || 0;
    const row = perLayer.get(l) || 0;
    perLayer.set(l, row + 1);
    pos[n.id] = { x: X0 + l * COL_W, y: Y0 + row * ROW_H };
  }
  return pos;
}

interface BottomBarProps {
  running: boolean;
  error: string;
  onRun: () => void;
  onStop: () => void;
  onAutoLayout: () => void;
}

function BottomBar({ running, error, onRun, onStop, onAutoLayout }: BottomBarProps) {
  const { zoomIn, zoomOut, fitView, deleteElements, getNodes } = useReactFlow();
  const zoom = useStore((s) => s.transform[2]);

  const deleteSelected = () => {
    const sel = getNodes().filter((n) => n.selected);
    if (sel.length) deleteElements({ nodes: sel });
  };

  return (
    <Panel position="bottom-center" className="wf-bottombar">
      <button type="button" className="wf-bb-btn" onClick={() => zoomOut()} title="Thu nhỏ">
        <ZoomOut size={16} />
      </button>
      <span className="wf-bb-zoom">{Math.round((zoom || 1) * 100)}%</span>
      <button type="button" className="wf-bb-btn" onClick={() => zoomIn()} title="Phóng to">
        <ZoomIn size={16} />
      </button>
      <span className="wf-bb-sep" />
      <button
        type="button"
        className="wf-bb-btn"
        onClick={() => fitView({ duration: 300 })}
        title="Vừa màn hình"
      >
        <Maximize size={16} />
      </button>
      <button
        type="button"
        className="wf-bb-btn"
        onClick={onAutoLayout}
        title="Sắp xếp tự động"
      >
        <Workflow size={16} />
      </button>
      <button
        type="button"
        className="wf-bb-btn wf-bb-danger"
        onClick={deleteSelected}
        title="Xóa node đang chọn (hoặc nhấn Delete)"
      >
        <Trash2 size={16} />
      </button>
      <span className="wf-bb-sep" />
      {error && <span className="wf-bb-error" title={error}>{error}</span>}
      {running ? (
        <button type="button" className="wf-bb-run wf-bb-stop" onClick={onStop}>
          <Square size={15} /> Dừng
        </button>
      ) : (
        <button type="button" className="wf-bb-run" onClick={onRun}>
          <Play size={15} /> Chạy quy trình
        </button>
      )}
    </Panel>
  );
}

interface NewWorkflowModalProps {
  open: boolean;
  onCreate: (name: string) => void;
  onClose: () => void;
}

function NewWorkflowModal({ open, onCreate, onClose }: NewWorkflowModalProps) {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const canCreate = name.trim().length > 0;
  const submit = () => {
    if (canCreate) onCreate(name);
  };

  return (
    <div className="wf-new-overlay" onClick={onClose}>
      <div className="wf-new-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="wf-new-title">Quy trình mới</h3>
        <input
          ref={inputRef}
          className="wf-new-input"
          placeholder="Tên quy trình..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') onClose();
          }}
        />
        <div className="wf-new-actions">
          <button type="button" className="wf-new-cancel" onClick={onClose}>
            Quay lại
          </button>
          <button type="button" className="wf-new-create" onClick={submit} disabled={!canCreate}>
            Tạo
          </button>
        </div>
      </div>
    </div>
  );
}

function Flow() {
  const initialState = useMemo(() => loadTabsState(defaultGraph()), []);
  const initialTab =
    initialState.tabs.find((t) => t.id === initialState.activeId) ?? initialState.tabs[0];

  const [tabs, setTabs] = useState<WorkflowTab[]>(initialState.tabs);
  const [activeId, setActiveId] = useState(initialState.activeId);
  const [nodes, setNodes, onNodesChange] = useNodesState<WFNode>(initialTab.nodes as WFNode[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialTab.edges);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  const [libCount, setLibCount] = useState(() => loadTemplates().length);
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [mediaModal, setMediaModal] = useState<{
    nodeId: string;
    kind: MediaInputKind;
    draft: MediaInputDraft;
    isNew: boolean;
    position: { x: number; y: number };
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { screenToFlowPosition, fitView, deleteElements } = useReactFlow();

  useEffect(() => onLibraryUpdated(() => setLibCount(loadTemplates().length)), []);

  const handleAutoLayout = () => {
    const pos = autoLayout(nodes, edges);
    setNodes((nds) => nds.map((n) => (pos[n.id] ? { ...n, position: pos[n.id] } : n)));
    setTimeout(() => fitView({ duration: 300 }), 60);
  };

  /** Agent apply graph lên canvas + lưu tab. */
  const applyAgentGraph = useCallback(
    (nextNodes: Node[], nextEdges: Edge[], opts?: { focusView?: boolean }) => {
      setNodes(nextNodes as WFNode[]);
      setEdges(nextEdges);
      const now = new Date().toISOString();
      const updated = tabs.map((t) =>
        t.id === activeId
          ? { ...t, nodes: nextNodes as WFNode[], edges: nextEdges, updatedAt: now }
          : t,
      );
      setTabs(updated);
      saveTabsState({ tabs: updated, activeId });
      if (opts?.focusView) {
        setTimeout(() => fitView({ duration: 300 }), 60);
      }
    },
    [tabs, activeId, setNodes, setEdges, fitView],
  );

  /** Ghi graph hiện tại vào tab đang mở. */
  const commitActive = useCallback((): WorkflowTab[] => {
    const now = new Date().toISOString();
    return tabs.map((t) =>
      t.id === activeId ? { ...t, nodes, edges, updatedAt: now } : t,
    );
  }, [tabs, activeId, nodes, edges]);

  const selectTab = (id: string) => {
    if (id === activeId) return;
    const updated = commitActive();
    const target = updated.find((t) => t.id === id);
    if (!target) return;
    setTabs(updated);
    setActiveId(id);
    setNodes(target.nodes as WFNode[]);
    setEdges(target.edges);
    saveTabsState({ tabs: updated, activeId: id });
  };

  const newTab = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const updated = commitActive();
    const g = defaultGraph();
    const tpl = saveTemplate(trimmed, g);
    const tab = makeTab(tpl.name, g, tpl.id);
    const next = [...updated, tab];
    setTabs(next);
    setActiveId(tab.id);
    setNodes(g.nodes);
    setEdges(g.edges);
    saveTabsState({ tabs: next, activeId: tab.id });
    setNewOpen(false);
  };

  const closeTab = (id: string) => {
    if (tabs.length <= 1) return;
    const idx = tabs.findIndex((t) => t.id === id);
    const updated = commitActive().filter((t) => t.id !== id);
    let nextActive = activeId;
    if (id === activeId) {
      const neighbor = updated[Math.max(0, idx - 1)] ?? updated[0];
      nextActive = neighbor.id;
      setActiveId(nextActive);
      setNodes(neighbor.nodes as WFNode[]);
      setEdges(neighbor.edges);
    }
    setTabs(updated);
    saveTabsState({ tabs: updated, activeId: nextActive });
  };

  const togglePin = (id: string) => {
    const base = id === activeId ? commitActive() : tabs;
    const updated = base.map((t) => (t.id === id ? { ...t, pinned: !t.pinned } : t));
    setTabs(updated);
    saveTabsState({ tabs: updated, activeId });
  };

  const updateNode = useCallback(
    (id: string, patch: Partial<NodeData>) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
      );
    },
    [setNodes],
  );

  const isMediaNodeType = (type: string) => type === 'input-image' || type === 'input-video';

  const openMediaInputModal = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node?.type || !isMediaNodeType(node.type)) return;
      setMediaModal({
        nodeId,
        kind: node.type === 'input-image' ? 'image' : 'video',
        draft: draftFromNodeData(node.data as Record<string, unknown>),
        isNew: false,
        position: node.position,
      });
    },
    [nodes],
  );

  const ctx = useMemo<WorkflowCtxValue>(
    () => ({ updateNode, openMediaInputModal }),
    [updateNode, openMediaInputModal],
  );

  const onConnect = useCallback(
    (c: Connection) => setEdges((eds) => addEdge({ ...c, type: 'wf' }, eds)),
    [setEdges],
  );

  const addNodeAt = useCallback(
    (type: string, position: { x: number; y: number }) => {
      if (!(type in nodeTypes)) return;
      if (isMediaNodeType(type)) {
        const id = `${type}-${nodeCounter++}`;
        setMediaModal({
          nodeId: id,
          kind: type === 'input-image' ? 'image' : 'video',
          draft: defaultMediaInputDraft(),
          isNew: true,
          position,
        });
        return;
      }
      const id = `${type}-${nodeCounter++}`;
      const node: WFNode = { id, type, position, data: {} };
      setNodes((nds) => [...nds, node]);
    },
    [setNodes],
  );

  const addNode = useCallback(
    (type: string) =>
      addNodeAt(type, { x: 120 + Math.random() * 240, y: 80 + Math.random() * 240 }),
    [addNodeAt],
  );

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('application/wf-node');
      if (!type) return;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      addNodeAt(type, position);
    },
    [addNodeAt, screenToFlowPosition],
  );

  const handleSave = () => {
    saveWorkflow(nodes, edges);
    const updated = commitActive();
    setTabs(updated);
    saveTabsState({ tabs: updated, activeId });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const openTemplate = (t: SavedTemplate) => {
    const updated = commitActive();
    const tab = makeTab(t.name, { nodes: t.nodes, edges: t.edges }, t.id);
    const next = [...updated, tab];
    setTabs(next);
    setActiveId(tab.id);
    setNodes(t.nodes as WFNode[]);
    setEdges(t.edges);
    saveWorkflow(t.nodes as WFNode[], t.edges);
    saveTabsState({ tabs: next, activeId: tab.id });
  };

  const handleClear = () => {
    if (!window.confirm('Xóa toàn bộ sơ đồ trong tab này?')) return;
    clearWorkflow();
    const g = defaultGraph();
    setNodes(g.nodes);
    setEdges(g.edges);
    const now = new Date().toISOString();
    const updated = tabs.map((t) =>
      t.id === activeId ? { ...t, nodes: g.nodes, edges: g.edges, updatedAt: now } : t,
    );
    setTabs(updated);
    saveTabsState({ tabs: updated, activeId });
  };

  const stop = () => {
    abortRef.current?.abort();
    setRunning(false);
  };

  const saveMediaModal = (draft: MediaInputDraft) => {
    if (!mediaModal) return;
    const data: Partial<NodeData> = {
      ...draft,
      configured: true,
      resultUrl: draft.mediaUrls[0] || '',
    };
    if (mediaModal.isNew) {
      setNodes((nds) => [
        ...nds,
        {
          id: mediaModal.nodeId,
          type: mediaModal.kind === 'image' ? 'input-image' : 'input-video',
          position: mediaModal.position,
          data,
        },
      ]);
    } else {
      updateNode(mediaModal.nodeId, data);
    }
    setMediaModal(null);
  };

  const deleteMediaModalNode = () => {
    if (!mediaModal) return;
    if (!mediaModal.isNew) {
      deleteElements({ nodes: [{ id: mediaModal.nodeId }] });
    }
    setMediaModal(null);
  };

  async function runWorkflow() {
    setError('');

    const hasControl = nodes.some((n) => n.type === 'condition' || n.type === 'loop');
    let order: WFNode[] | null = null;
    if (!hasControl) {
      order = topoSort(nodes, edges);
      if (!order) {
        setError('Sơ đồ có vòng lặp — thêm node Vòng lặp để lặp lại.');
        return;
      }
    }

    const ac = new AbortController();
    abortRef.current = ac;
    const signal = ac.signal;
    setRunning(true);

    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, status: 'idle' as WFStatus, statusText: undefined, error: undefined },
      })),
    );

    const outputs: Record<string, string> = {};
    const outputByHandle: Record<string, Record<string, string>> = {};
    const usedMediaUrls = new Set<string>();
    const incoming = (id: string) => edges.filter((e) => e.target === id).map((e) => e.source);

    const resolveEdgeOutput = (edge: Edge): string | undefined => {
      const byHandle = outputByHandle[edge.source];
      if (edge.sourceHandle && byHandle?.[edge.sourceHandle]) {
        return byHandle[edge.sourceHandle];
      }
      return outputs[edge.source];
    };

    const getInputs = (id: string) => {
      const ins = edges.filter((e) => e.target === id);
      const ups = ins
        .map((e) => resolveEdgeOutput(e))
        .filter((u): u is string => Boolean(u));
      return {
        upText: ups.find((u) => !/^https?:\/\//i.test(u)),
        upUrl: ups.find((u) => /^https?:\/\//i.test(u)),
      };
    };

    /** Chạy một node; trả về output (chuỗi) và/hoặc nhánh rẽ cho node Điều kiện. */
    async function processNode(
      node: WFNode,
      upText?: string,
      upUrl?: string,
    ): Promise<{ output?: string; branch?: 'true' | 'false' }> {
      switch (node.type) {
        case 'note':
          return {};
        case 'start':
          updateNode(node.id, { status: 'done' });
          return {};
        case 'end':
          updateNode(node.id, { status: 'done', statusText: 'Hoàn tất' });
          return {};
        case 'delay': {
          const secs = Math.max(0, Number(node.data.seconds ?? 1));
          updateNode(node.id, { status: 'running', statusText: `Chờ ${secs}s…` });
          await sleep(secs * 1000, signal);
          updateNode(node.id, { status: 'done', statusText: undefined });
          return { output: upUrl || upText || '' };
        }
        case 'clone':
          updateNode(node.id, { status: 'done' });
          return { output: upUrl || upText || '' };
        case 'notify': {
          const msg = String(node.data.prompt || upText || upUrl || '(trống)');
          updateNode(node.id, { status: 'done', statusText: `Đã gửi: ${msg.slice(0, 40)}` });
          return { output: upUrl || upText || '' };
        }
        case 'condition': {
          const value = upText || upUrl || '';
          const ok = evalCondition(value, String(node.data.op || 'not_empty'), node.data.compare);
          updateNode(node.id, { status: 'done', statusText: ok ? 'Đúng ✓' : 'Sai ✗' });
          return { output: value, branch: ok ? 'true' : 'false' };
        }
        case 'loop':
          // Vòng lặp được xử lý ở activate(); ở đây chỉ truyền dữ liệu qua.
          return { output: upUrl || upText || '' };
        case 'text':
          updateNode(node.id, { status: 'done' });
          return { output: String(node.data.prompt || '') };
        case 'input-image':
        case 'input-video': {
          const draft = draftFromNodeData(node.data as Record<string, unknown>);
          const resolved = resolveMediaInputUrls(
            node.id,
            node.data as Record<string, unknown>,
            edges,
            outputs,
            usedMediaUrls,
          );
          let primary = resolved.primary;
          let frameUrl = resolved.firstFrame;

          if (node.type === 'input-video' && primary) {
            updateNode(node.id, { status: 'running', statusText: 'Trích frame…' });
            frameUrl = await extractVideoFirstFrame(primary);
          }

          if (!primary && draft.required) {
            updateNode(node.id, { status: 'error', error: 'Chưa có ảnh/video (bắt buộc)' });
            throw new Error('Chưa có ảnh/video');
          }

          if (!primary && !draft.required) {
            updateNode(node.id, { status: 'done', statusText: 'Bỏ qua (không bắt buộc)' });
            outputByHandle[node.id] = { done: 'ok', 'media-out': '', all: '[]', 'first-frame': '' };
            return { output: '' };
          }

          outputByHandle[node.id] =
            node.type === 'input-image'
              ? {
                  done: primary,
                  'media-out': primary,
                  all: JSON.stringify(resolved.all),
                }
              : {
                  done: primary,
                  'media-out': primary,
                  'first-frame': frameUrl || primary,
                };

          outputs[node.id] = primary;
          updateNode(node.id, {
            status: 'done',
            resultUrl: primary,
            statusText: undefined,
            error: undefined,
          });
          return { output: primary };
        }
        case 'api': {
          const url = String(node.data.url || '').trim();
          if (!url) {
            updateNode(node.id, { status: 'error', error: 'Chưa nhập URL' });
            throw new Error('Gọi API: chưa nhập URL');
          }
          const method = String(node.data.method || 'GET').toUpperCase();
          const body = String(node.data.prompt || upText || '').trim();
          updateNode(node.id, { status: 'running', statusText: `${method}…` });
          try {
            const hasBody = method !== 'GET' && method !== 'HEAD' && body.length > 0;
            const res = await fetch(url, {
              method,
              headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
              body: hasBody ? body : undefined,
              signal,
            });
            const text = await res.text();
            updateNode(node.id, {
              status: res.ok ? 'done' : 'error',
              statusText: `HTTP ${res.status}`,
              error: res.ok ? undefined : `HTTP ${res.status}`,
            });
            if (!res.ok) throw new Error(`Gọi API lỗi HTTP ${res.status}`);
            return { output: text };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            updateNode(node.id, { status: 'error', statusText: undefined, error: msg });
            throw err;
          }
        }
        case 'output': {
          updateNode(node.id, {
            resultUrl: upUrl,
            status: upUrl ? 'done' : 'error',
            error: upUrl ? undefined : 'Không có đầu vào',
          });
          return { output: upUrl };
        }
        case 'render': {
          if (!upUrl) {
            updateNode(node.id, { status: 'error', error: 'Không có video đầu vào' });
            throw new Error('Render: không có video đầu vào');
          }
          updateNode(node.id, { status: 'done', statusText: 'Đã ghép (pass-through)' });
          return { output: upUrl };
        }
        default: {
          const type = node.type as JobType;
          const selections: JobSelections = {};
          if (type === 'tts') {
            selections.text = node.data.text || upText || node.data.prompt || '';
          } else {
            selections.prompt = node.data.prompt || upText || '';
          }
          if (type === 'video' && upUrl) selections.images = [upUrl];

          const modelId = String(node.data.modelId || '');
          if (!modelId) {
            updateNode(node.id, { status: 'error', error: 'Chưa chọn model' });
            throw new Error('Chưa chọn model');
          }

          updateNode(node.id, { status: 'running', statusText: 'Bắt đầu…' });
          try {
            const url = await runNodeJob({
              type,
              modelId,
              selections,
              onStatus: (s) => updateNode(node.id, { statusText: s }),
              signal,
            });
            updateNode(node.id, { status: 'done', resultUrl: url, statusText: undefined });
            return { output: url };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            updateNode(node.id, { status: 'error', statusText: undefined, error: msg });
            throw err;
          }
        }
      }
    }

    try {
      if (!hasControl && order) {
        // Đồ thị tuyến tính: chạy 1 lượt theo topo (xử lý join chính xác).
        for (const node of order) {
          const { upText, upUrl } = getInputs(node.id);
          const res = await processNode(node, upText, upUrl);
          if (res.output !== undefined) outputs[node.id] = res.output;
        }
      } else {
        // Có node điều khiển: chạy theo activation, hỗ trợ rẽ nhánh + lặp.
        const byId = new Map(nodes.map((n) => [n.id, n]));
        const targetsOf = (id: string, handle?: string) =>
          edges
            .filter(
              (e) => e.source === id && (handle == null || (e.sourceHandle ?? null) === handle),
            )
            .map((e) => e.target);
        const reachable = (starts: string[], stopId: string) => {
          const seen = new Set<string>();
          const stack = [...starts];
          while (stack.length) {
            const cur = stack.pop()!;
            if (cur === stopId || seen.has(cur)) continue;
            seen.add(cur);
            for (const t of edges.filter((e) => e.source === cur).map((e) => e.target)) {
              stack.push(t);
            }
          }
          return seen;
        };

        const done = new Set<string>();
        let steps = 0;

        const activate = async (id: string): Promise<void> => {
          if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
          if (++steps > 2000) throw new Error('Quá nhiều bước — kiểm tra vòng lặp.');
          const node = byId.get(id);
          if (!node || done.has(id)) return;

          const { upText, upUrl } = getInputs(id);
          const res = await processNode(node, upText, upUrl);
          if (res.output !== undefined) outputs[id] = res.output;
          done.add(id);

          if (node.type === 'condition') {
            for (const t of targetsOf(id, res.branch === 'true' ? 'true' : 'false')) {
              await activate(t);
            }
            return;
          }

          if (node.type === 'loop') {
            const eachTargets = targetsOf(id, 'each');
            const body = reachable(eachTargets, id);
            const count = Math.max(1, Math.floor(Number(node.data.count ?? 3)));
            for (let i = 0; i < count; i++) {
              if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
              updateNode(id, { status: 'running', statusText: `Vòng ${i + 1}/${count}` });
              for (const b of body) done.delete(b);
              for (const t of eachTargets) await activate(t);
            }
            updateNode(id, { status: 'done', statusText: `Xong ${count} vòng` });
            for (const t of targetsOf(id, 'done')) await activate(t);
            return;
          }

          for (const t of targetsOf(id)) await activate(t);
        };

        const roots = nodes.filter((n) => incoming(n.id).length === 0);
        if (roots.length === 0) throw new Error('Không tìm thấy node bắt đầu (không có đầu vào).');
        for (const r of roots) await activate(r.id);
      }
    } catch (err) {
      if ((err as { name?: string })?.name !== 'AbortError') {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setRunning(false);
    }
  }

  return (
    <WorkflowCtx.Provider value={ctx}>
      <div className="wf-page">
        <WorkflowTopBar
          tabs={tabs}
          activeId={activeId}
          libraryCount={libCount}
          onSelect={selectTab}
          onClose={closeTab}
          onNew={() => setNewOpen(true)}
          onTogglePin={togglePin}
          onOpenLibrary={() => setLibOpen(true)}
          saved={saved}
          onSave={handleSave}
          onClear={handleClear}
        />
        <div className={`wf-shell${agentOpen ? ' agent-open' : ''}`}>
        <Palette onAdd={addNode} open={paletteOpen} onToggle={() => setPaletteOpen(false)} />

        <div className="wf-canvas" onDragOver={onDragOver} onDrop={onDrop}>
          {!paletteOpen && (
            <button
              type="button"
              className="wf-palette-reopen"
              onClick={() => setPaletteOpen(true)}
              title="Mở sidebar node"
            >
              <PanelLeftOpen size={16} />
            </button>
          )}
          <ReactFlow
            nodes={nodes}
            edges={edges}
            minZoom={0.1}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDoubleClick={(_, node) => {
              if (node.type && isMediaNodeType(node.type)) {
                openMediaInputModal(node.id);
              }
            }}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={{ type: 'wf' }}
            fitView
            deleteKeyCode={['Backspace', 'Delete']}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={18} />
            <MiniMap
              pannable
              zoomable
              bgColor="#0d0e12"
              maskColor="rgba(8, 9, 12, 0.6)"
              nodeColor="#2b303a"
              nodeStrokeColor="#3a4150"
              nodeBorderRadius={4}
            />
            <BottomBar
              running={running}
              error={error}
              onRun={runWorkflow}
              onStop={stop}
              onAutoLayout={handleAutoLayout}
            />
          </ReactFlow>
        </div>

        <WorkflowAgentPanel
          open={agentOpen}
          onOpenChange={setAgentOpen}
          tabName={tabs.find((t) => t.id === activeId)?.name ?? 'Workflow'}
          nodes={nodes}
          edges={edges}
          onApplyGraph={applyAgentGraph}
        />
        </div>
      </div>

      <WorkflowLibrary
        open={libOpen}
        currentGraph={() => ({ nodes, edges })}
        onOpenTemplate={openTemplate}
        onClose={() => setLibOpen(false)}
      />

      <NewWorkflowModal open={newOpen} onCreate={newTab} onClose={() => setNewOpen(false)} />

      {mediaModal && (
        <WorkflowMediaInputModal
          open
          kind={mediaModal.kind}
          draft={mediaModal.draft}
          isNew={mediaModal.isNew}
          onSave={saveMediaModal}
          onDelete={deleteMediaModalNode}
          onClose={() => setMediaModal(null)}
        />
      )}
    </WorkflowCtx.Provider>
  );
}

export default function WorkflowPage() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
}
```

---

## src/services/workflowAgentActions.ts

```typescript
import type { Edge, Node } from '@xyflow/react';

/** Một thao tác dự kiến lên canvas (hiển thị + thực thi). */
export interface WorkflowAgentAction {
  kind:
    | 'delete_all'
    | 'delete_node'
    | 'replace_graph'
    | 'add_node'
    | 'connect'
    | 'update_node'
    | 'focus_view';
  label: string;
  nodeId?: string;
  nodeType?: string;
  /** Alias để resolve Connect (vd. genImageNode). */
  nodeRef?: string;
  position?: { x: number; y: number };
  data?: Record<string, unknown>;
  source?: string;
  target?: string;
  sourceHandle?: string;
  targetHandle?: string;
  nodes?: Node[];
  edges?: Edge[];
}

export interface ApplyResult {
  nodes: Node[];
  edges: Edge[];
  applied: WorkflowAgentAction[];
  focusView?: boolean;
}

interface GommoActionPayload {
  capability?: string;
  capabilityId?: string;
  title?: string;
  description?: string;
  prompt?: string;
  mode?: string;
  layout?: unknown;
  actions?: unknown[];
  edges?: unknown[];
  input?: {
    mode?: string;
    brief?: string;
    actions?: unknown[];
    layout?: unknown;
    edges?: unknown[];
  };
}

interface GommoActionBlock {
  gommo_action?: GommoActionPayload;
  actions?: unknown[];
}

const VALID_NODE_TYPES = new Set([
  'start',
  'text',
  'image',
  'video',
  'tts',
  'music',
  'api',
  'condition',
  'delay',
  'loop',
  'clone',
  'notify',
  'note',
  'output',
  'end',
  'input-image',
  'input-video',
  'render',
]);

const NODE_TYPE_ALIASES: Record<string, string> = {
  start: 'start',
  end: 'end',
  text: 'text',
  prompt: 'text',
  'text-prompt': 'text',
  output: 'output',
  result: 'output',
  image: 'image',
  'generate-image': 'image',
  generate_image: 'image',
  genimage: 'image',
  'image-generate': 'image',
  video: 'video',
  'generate-video': 'video',
  generate_video: 'video',
  tts: 'tts',
  music: 'music',
  api: 'api',
  condition: 'condition',
  delay: 'delay',
  loop: 'loop',
  clone: 'clone',
  notify: 'notify',
  note: 'note',
  'input-image': 'input-image',
  'input-video': 'input-video',
  'nhap-anh': 'input-image',
  'nhap-video': 'input-video',
  'import-image': 'input-image',
  'import-video': 'input-video',
};

const DELETE_ALL_RE =
  /xóa\s+(hết|tất\s+cả|toàn\s+bộ)|xoa\s+(het|tat\s+ca)|clear\s+all|delete\s+all/i;

const CREATE_WFL_RE =
  /tạo.*(?:wfl|workflow|quy\s*trình)|tao.*(?:wfl|workflow)|create.*workflow/i;

let nodeSeq = 0;

function stripRuntimeData(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object') return {};
  const d = { ...(data as Record<string, unknown>) };
  delete d.status;
  delete d.statusText;
  delete d.resultUrl;
  delete d.error;
  return d;
}

function mapNodeType(raw: string): string | null {
  const key = raw.trim().toLowerCase().replace(/\s+/g, '-');
  const mapped = NODE_TYPE_ALIASES[key] ?? key;
  return VALID_NODE_TYPES.has(mapped) ? mapped : null;
}

function defaultPosition(type: string, index: number): { x: number; y: number } {
  const col = index * 280;
  const yByType: Record<string, number> = {
    start: 140,
    text: 100,
    image: 80,
    output: 100,
    end: 150,
  };
  return { x: 20 + col, y: yByType[type] ?? 120 };
}

function defaultNodeRef(type: string): string {
  if (type === 'start') return 'startNode';
  if (type === 'image') return 'genImageNode';
  if (type === 'output') return 'outputNode';
  if (type === 'end') return 'endNode';
  if (type === 'text') return 'textNode';
  return `${type}Node`;
}

function nextNodeId(type: string): string {
  nodeSeq += 1;
  return `${type}-${nodeSeq}`;
}

function resetNodeSeq(nodes: Node[]) {
  nodeSeq = nodes.reduce((max, n) => {
    const m = /^(\w+)-(\d+)$/.exec(n.id);
    if (!m) return max;
    return Math.max(max, Number(m[2]));
  }, 0);
}

/** Rút gọn graph gửi kèm prompt cho model. */
export function buildWorkflowSnapshot(
  tabName: string,
  nodes: Node[],
  edges: Edge[],
): string {
  const summary = {
    tab: tabName,
    nodeTypes: [...VALID_NODE_TYPES],
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type,
      x: Math.round(n.position.x),
      y: Math.round(n.position.y),
      data: stripRuntimeData(n.data),
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
    })),
  };
  return JSON.stringify(summary, null, 2);
}

function wantsDeleteAll(...texts: (string | undefined)[]): boolean {
  return texts.some((t) => t && DELETE_ALL_RE.test(t));
}

function isWorkflowEditCapability(ga: GommoActionPayload): boolean {
  const cap = String(ga.capability ?? ga.capabilityId ?? '').toLowerCase();
  return cap === 'workflow_edit' || cap === 'workflow.edit';
}

/** Trích JSON object có marker (gommo_action) bằng đếm ngoặc. */
function extractJsonBlocks(text: string, marker: string): unknown[] {
  const out: unknown[] = [];
  let from = 0;
  while (from < text.length) {
    const idx = text.indexOf(marker, from);
    if (idx === -1) break;
    const start = text.lastIndexOf('{', idx);
    if (start === -1) {
      from = idx + marker.length;
      continue;
    }
    let depth = 0;
    let end = -1;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end !== -1) {
      try {
        out.push(JSON.parse(text.slice(start, end + 1)));
      } catch {
        /* bỏ qua */
      }
    }
    from = idx + marker.length;
  }
  return out;
}

function normalizeLayoutNodes(nodes: Node[]): Node[] {
  return nodes.map((n) => {
    const type = mapNodeType(String(n.type ?? 'default')) ?? String(n.type);
    return { ...n, type };
  });
}

function parseLayoutGraph(raw: unknown): { nodes: Node[]; edges: Edge[] } | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  let layout = obj.layout ?? obj.nodes;
  let edgeList = obj.edges ?? obj.connections;

  if (Array.isArray(raw)) layout = raw;

  if (!Array.isArray(layout) || layout.length === 0) return null;

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  for (const item of layout) {
    if (!item || typeof item !== 'object') continue;
    const n = item as Record<string, unknown>;
    const id = String(n.id ?? n.node_id ?? '');
    if (!id) continue;
    const rawType = String(n.type ?? n.node_type ?? 'default');
    const type = mapNodeType(rawType) ?? rawType;
    const pos = (n.position ?? n.pos ?? {}) as Record<string, number>;
    nodes.push({
      id,
      type,
      position: {
        x: Number(pos.x ?? n.x ?? 0),
        y: Number(pos.y ?? n.y ?? 0),
      },
      data: stripRuntimeData(n.data ?? n.config),
    });
  }

  if (Array.isArray(edgeList)) {
    for (const item of edgeList) {
      if (!item || typeof item !== 'object') continue;
      const e = item as Record<string, unknown>;
      const source = String(e.source ?? e.from ?? e.sourceId ?? '');
      const target = String(e.target ?? e.to ?? e.targetId ?? '');
      if (!source || !target) continue;
      edges.push({
        id: String(e.id ?? `e_${source}_${target}`),
        source,
        target,
        sourceHandle: e.sourceHandle ? String(e.sourceHandle) : undefined,
        targetHandle: e.targetHandle ? String(e.targetHandle) : undefined,
        type: 'wf',
      });
    }
  }

  const normalized = normalizeLayoutNodes(nodes);
  return normalized.length ? { nodes: normalized, edges } : null;
}

function pushDeleteNode(actions: WorkflowAgentAction[], nodeId: string) {
  if (actions.some((a) => a.kind === 'delete_node' && a.nodeId === nodeId)) return;
  actions.push({
    kind: 'delete_node',
    nodeId,
    label: `Delete node: ${nodeId}`,
  });
}

function pushAddNode(
  actions: WorkflowAgentAction[],
  typeRaw: string,
  opts?: {
    id?: string;
    ref?: string;
    position?: { x: number; y: number };
    data?: Record<string, unknown>;
    label?: string;
  },
) {
  const type = mapNodeType(typeRaw);
  if (!type) return;
  const id = opts?.id ?? nextNodeId(type);
  const ref = opts?.ref ?? defaultNodeRef(type);
  const label = opts?.label ?? `Add ${typeRaw}`;
  if (actions.some((a) => a.kind === 'add_node' && a.nodeId === id)) return;
  actions.push({
    kind: 'add_node',
    label,
    nodeId: id,
    nodeType: type,
    nodeRef: ref,
    position: opts?.position,
    data: opts?.data,
  });
}

function pushConnect(
  actions: WorkflowAgentAction[],
  source: string,
  target: string,
  sourceHandle?: string,
  targetHandle?: string,
  label?: string,
) {
  const key = `${source}|${target}|${sourceHandle ?? ''}|${targetHandle ?? ''}`;
  if (
    actions.some(
      (a) =>
        a.kind === 'connect' &&
        `${a.source}|${a.target}|${a.sourceHandle ?? ''}|${a.targetHandle ?? ''}` === key,
    )
  ) {
    return;
  }
  const sh = sourceHandle ? `.${sourceHandle}` : '';
  const th = targetHandle ? `.${targetHandle}` : '';
  actions.push({
    kind: 'connect',
    label: label ?? `Connect ${source}${sh} -> ${target}${th}`,
    source,
    target,
    sourceHandle,
    targetHandle,
  });
}

function pushUpdateNode(
  actions: WorkflowAgentAction[],
  nodeId: string,
  data: Record<string, unknown>,
  label?: string,
) {
  actions.push({
    kind: 'update_node',
    label: label ?? `Update node: ${nodeId}`,
    nodeId,
    data,
  });
}

function pushFocusView(actions: WorkflowAgentAction[]) {
  if (actions.some((a) => a.kind === 'focus_view')) return;
  actions.push({ kind: 'focus_view', label: 'Focus viewport' });
}

function optionalHandle(v: unknown): string | undefined {
  if (v == null || v === 'null') return undefined;
  const s = String(v).trim();
  return s || undefined;
}

/** JSON phẳng { capabilityId, input } hoặc bọc { gommo_action }. */
function resolveGommoPayload(block: unknown): GommoActionPayload | null {
  if (!block || typeof block !== 'object') return null;
  const b = block as GommoActionBlock & GommoActionPayload;
  if (b.gommo_action && typeof b.gommo_action === 'object') return b.gommo_action;
  if (b.capabilityId || b.capability || b.input?.actions || Array.isArray(b.actions)) {
    return b as GommoActionPayload;
  }
  return null;
}

/** Gommo hay trả node lồng: { type: "add_node", node: { id, type, data } }. */
function flattenActionNode(act: Record<string, unknown>): Record<string, unknown> {
  const node = act.node;
  if (!node || typeof node !== 'object' || Array.isArray(node)) return act;
  const n = node as Record<string, unknown>;
  return {
    ...act,
    id: act.id ?? n.id,
    nodeId: act.nodeId ?? act.node_id ?? n.id,
    nodeType: act.nodeType ?? act.node_type ?? n.type,
    position: act.position ?? act.pos ?? n.position,
    data: act.data ?? n.data,
    ref: act.ref ?? n.id,
  };
}

function extractPatchData(act: Record<string, unknown>): Record<string, unknown> {
  const raw = act.data ?? act.patch ?? {};
  if (!raw || typeof raw !== 'object') return {};
  const d = stripRuntimeData(raw);
  if (d.data && typeof d.data === 'object' && !Array.isArray(d.data)) {
    const inner = stripRuntimeData(d.data);
    const { data: _drop, ...rest } = d;
    return { ...rest, ...inner };
  }
  return d;
}

function parseStructuredAction(act: Record<string, unknown>, actions: WorkflowAgentAction[]) {
  act = flattenActionNode(act);
  const rawTypeField = String(act.type ?? '').toLowerCase();
  const rawActionField = String(act.action ?? act.kind ?? '').toLowerCase();
  const addTypes = new Set(['add_node', 'add-node', 'add', 'create_node', 'create-node']);
  const type = addTypes.has(rawTypeField) ? rawTypeField : rawActionField || rawTypeField;

  if (type.includes('delete') && (type.includes('all') || act.all === true)) {
    actions.push({ kind: 'delete_all', label: 'Delete all nodes' });
    return;
  }

  if (type.includes('delete')) {
    const nodeId = String(act.nodeId ?? act.node_id ?? act.id ?? '');
    if (nodeId) pushDeleteNode(actions, nodeId);
    return;
  }

  if (addTypes.has(type) || addTypes.has(rawActionField)) {
    let rawType = String(
      act.nodeType ?? act.node_type ?? act.typeName ?? act.name ?? '',
    ).trim();
    if (!rawType || addTypes.has(rawType.toLowerCase())) {
      const candidate = addTypes.has(rawTypeField) ? rawActionField : rawTypeField;
      const mapped = mapNodeType(candidate);
      if (mapped) rawType = mapped;
    }
    if (!rawType) return;
    const id = act.id ?? act.nodeId ?? act.node_id;
    const pos = act.position ?? act.pos;
    const position =
      pos && typeof pos === 'object'
        ? {
            x: Number((pos as Record<string, unknown>).x ?? 0),
            y: Number((pos as Record<string, unknown>).y ?? 0),
          }
        : undefined;
    const data = stripRuntimeData(act.data ?? act.config);
    delete data.label;
    if (act.prompt && !data.prompt) data.prompt = act.prompt;
    const nodeId = id ? String(id) : undefined;
    pushAddNode(actions, rawType, {
      id: nodeId,
      ref: act.ref ? String(act.ref) : nodeId,
      position,
      data: Object.keys(data).length ? data : undefined,
    });
    return;
  }

  if (type === 'connect' || type === 'edge' || type === 'link') {
    const source = String(act.source ?? act.from ?? act.sourceId ?? act.sourceNode ?? '');
    const target = String(act.target ?? act.to ?? act.targetId ?? act.targetNode ?? '');
    if (!source || !target) return;
    pushConnect(
      actions,
      source,
      target,
      optionalHandle(act.sourceHandle ?? act.sourcePort),
      optionalHandle(act.targetHandle ?? act.targetPort),
    );
    return;
  }

  if (
    type === 'update_node' ||
    type === 'update-node' ||
    type === 'set_data' ||
    type === 'set-data' ||
    type === 'patch_node'
  ) {
    const nodeId = String(act.nodeId ?? act.node_id ?? act.id ?? act.ref ?? '');
    if (!nodeId) return;
    const data = extractPatchData(act);
    if (act.prompt) data.prompt = act.prompt;
    if (act.text) data.text = act.text;
    if (Object.keys(data).length === 0) return;
    pushUpdateNode(actions, nodeId, data);
    return;
  }

  if (
    type === 'focus_viewport' ||
    type === 'focus_view' ||
    type === 'focus-view' ||
    type === 'fit_view' ||
    type === 'fit-view'
  ) {
    pushFocusView(actions);
  }
}

function parseOneActionSegment(segment: string, actions: WorkflowAgentAction[]) {
  const trimmed = segment.trim();
  if (!trimmed) return;

  const addM = /^Add\s+([\w-]+)(?:\s+(?:as|id)\s+(\S+))?/i.exec(trimmed);
  if (addM) {
    pushAddNode(actions, addM[1], { id: addM[2] });
    return;
  }

  const connectM =
    /^Connect\s+(\S+?)(?:\.(\w+))?\s*(?:->|→|->>|—>)\s*(\S+?)(?:\.(\w+))?/i.exec(trimmed);
  if (connectM) {
    pushConnect(actions, connectM[1], connectM[4], connectM[2], connectM[5]);
    return;
  }

  const updateM =
    /^Update\s+(\S+)\s+(?:data\.)?(\w+)\s*=\s*["']?([^"'|]+?)["']?\s*$/i.exec(trimmed);
  if (updateM) {
    pushUpdateNode(actions, updateM[1], { [updateM[2]]: updateM[3].trim() });
    return;
  }

  if (/^Focus\s+(?:viewport|view|canvas)/i.test(trimmed)) {
    pushFocusView(actions);
  }
}

function parseTextLineActions(replyText: string, actions: WorkflowAgentAction[]) {
  for (const line of replyText.split('\n')) {
    const cleaned = line.replace(/^[\s\-*•\d.)]+/, '').trim();
    if (!cleaned) continue;
    const segments = cleaned.includes('|') ? cleaned.split('|') : [cleaned];
    for (const seg of segments) {
      parseOneActionSegment(seg, actions);
    }
  }
}

function hasCompleteStructuredWorkflow(actions: WorkflowAgentAction[]): boolean {
  const adds = actions.filter((a) => a.kind === 'add_node');
  const connects = actions.filter((a) => a.kind === 'connect');
  return adds.length >= 2 && connects.length >= 1;
}

function isIncompleteImageWorkflow(actions: WorkflowAgentAction[]): boolean {
  const adds = actions.filter((a) => a.kind === 'add_node');
  if (adds.length === 0) return false;
  const types = new Set(adds.map((a) => a.nodeType).filter(Boolean));
  if (types.has('start') && (!types.has('image') || !types.has('output'))) return true;
  if (adds.length === 1 && types.has('start')) return true;
  return false;
}

function extractPromptFromUserText(userText: string): string | null {
  const m =
    /(?:prompt|promt|với)\s+["“']?([^"”'\n.]+?)["”']?(?:\s*$|[.!?,])/i.exec(userText) ??
    /(?:ảnh|image)\s+(.+?)(?:\s*$|[.!?,])/i.exec(userText);
  return m?.[1]?.trim() || null;
}

/** Fallback: dựng WFL tạo ảnh khi user yêu cầu nhưng agent không trả action parse được. */
function buildImageWorkflowFallback(userText: string): WorkflowAgentAction[] {
  const prompt = extractPromptFromUserText(userText) ?? '';
  nodeSeq = 0;
  const actions: WorkflowAgentAction[] = [
    { kind: 'delete_all', label: 'Clear canvas' },
    {
      kind: 'add_node',
      label: 'Add start',
      nodeId: 'startNode',
      nodeType: 'start',
      nodeRef: 'startNode',
      position: { x: 80, y: 200 },
    },
    {
      kind: 'add_node',
      label: 'Add generate-image',
      nodeId: 'genImageNode',
      nodeType: 'image',
      nodeRef: 'genImageNode',
      position: { x: 320, y: 200 },
      data: prompt ? { prompt } : {},
    },
    {
      kind: 'add_node',
      label: 'Add output',
      nodeId: 'outputNode',
      nodeType: 'output',
      nodeRef: 'outputNode',
      position: { x: 560, y: 200 },
    },
    {
      kind: 'connect',
      label: 'Connect startNode -> genImageNode',
      source: 'startNode',
      target: 'genImageNode',
    },
    {
      kind: 'connect',
      label: 'Connect genImageNode -> outputNode',
      source: 'genImageNode',
      target: 'outputNode',
    },
    { kind: 'focus_view', label: 'Focus viewport' },
  ];
  return actions;
}

function parseGommoPayload(ga: GommoActionPayload, actions: WorkflowAgentAction[]) {
  const layoutGraph = parseLayoutGraph(ga.layout ?? ga.input?.layout ?? ga);
  if (layoutGraph) {
    actions.push({
      kind: 'replace_graph',
      label: ga.title ?? 'Thay thế workflow từ layout',
      nodes: layoutGraph.nodes,
      edges: layoutGraph.edges,
    });
    return;
  }

  const actionLists = [ga.actions, ga.input?.actions, ga.edges].filter(Array.isArray);
  for (const list of actionLists) {
    for (const a of list!) {
      if (!a || typeof a !== 'object') continue;
      parseStructuredAction(a as Record<string, unknown>, actions);
    }
  }

  if (Array.isArray(ga.edges)) {
    for (const e of ga.edges) {
      if (!e || typeof e !== 'object') continue;
      const edge = e as Record<string, unknown>;
      const source = String(edge.source ?? edge.from ?? '');
      const target = String(edge.target ?? edge.to ?? '');
      if (source && target) {
        pushConnect(
          actions,
          source,
          target,
          edge.sourceHandle ? String(edge.sourceHandle) : undefined,
          edge.targetHandle ? String(edge.targetHandle) : undefined,
        );
      }
    }
  }
}

function stripCodeFences(text: string): string {
  return text.replace(/```[\s\S]*?```/g, '');
}

function collectJsonBlocks(replyText: string): unknown[] {
  const seen = new Set<string>();
  const blocks: unknown[] = [];

  const push = (raw: unknown) => {
    const key = JSON.stringify(raw);
    if (seen.has(key)) return;
    seen.add(key);
    blocks.push(raw);
  };

  for (const m of replyText.matchAll(/```(?:json|gommo_action)?\s*([\s\S]*?)```/gi)) {
    try {
      push(JSON.parse(m[1].trim()));
    } catch {
      /* bỏ qua */
    }
  }

  for (const marker of ['gommo_action', 'capabilityId', 'workflow.edit']) {
    for (const raw of extractJsonBlocks(replyText, marker)) {
      push(raw);
    }
  }

  return blocks;
}

/** Parse câu trả lời agent → danh sách action có thể apply. */
export function parseAgentActions(
  replyText: string,
  userText: string,
  currentNodes: Node[],
): WorkflowAgentAction[] {
  resetNodeSeq(currentNodes);
  const actions: WorkflowAgentAction[] = [];

  for (const block of collectJsonBlocks(replyText)) {
    const ga = resolveGommoPayload(block);
    if (!ga) continue;
    parseGommoPayload(ga, actions);

    if (
      wantsDeleteAll(userText, ga.title, ga.prompt, ga.description, ga.input?.brief) &&
      (isWorkflowEditCapability(ga) ||
        !ga.layout ||
        (Array.isArray(ga.layout) && ga.layout.length === 0))
    ) {
      if (!actions.some((a) => a.kind === 'delete_all')) {
        actions.push({
          kind: 'delete_all',
          label: 'Xóa toàn bộ node trong workflow',
        });
      }
    }
  }

  if (!hasCompleteStructuredWorkflow(actions)) {
    parseTextLineActions(stripCodeFences(replyText), actions);
  }

  for (const m of replyText.matchAll(/Delete\s+node:\s*(\S+)/gi)) {
    pushDeleteNode(actions, m[1]);
  }

  if (actions.length === 0 && wantsDeleteAll(userText)) {
    for (const n of currentNodes) {
      if (replyText.includes(n.id)) pushDeleteNode(actions, n.id);
    }
  }

  if (actions.length === 0 && wantsDeleteAll(userText)) {
    if (/đã xóa|workflow.*trống|làm trống|canvas.*trống/i.test(replyText)) {
      actions.push({ kind: 'delete_all', label: 'Xóa toàn bộ node trong workflow' });
    }
  }

  const wantsImageWfl =
    CREATE_WFL_RE.test(userText) && /(?:ảnh|image|prompt|promt)/i.test(userText);
  const replyLooksLikeWfl = /(?:workflow|node|start|generate|output|bước|luồng)/i.test(replyText);

  if (wantsImageWfl && replyLooksLikeWfl && isIncompleteImageWorkflow(actions)) {
    return buildImageWorkflowFallback(userText);
  }

  const hasMutating = actions.some(
    (a) =>
      a.kind !== 'focus_view' &&
      !(a.kind === 'delete_node' && actions.some((x) => x.kind === 'replace_graph')),
  );

  if (!hasMutating && wantsImageWfl && replyLooksLikeWfl) {
    return buildImageWorkflowFallback(userText);
  }

  if (actions.some((a) => a.kind === 'add_node' || a.kind === 'connect')) {
    pushFocusView(actions);
  }

  return actions;
}

function buildRefRegistry(nodes: Node[]): Map<string, string> {
  const reg = new Map<string, string>();
  for (const n of nodes) {
    reg.set(n.id.toLowerCase(), n.id);
    reg.set(`${n.type}`.toLowerCase(), n.id);
    if (n.type === 'start') reg.set('startnode', n.id);
    if (n.type === 'image') {
      reg.set('genimagenode', n.id);
      reg.set('generate-image', n.id);
    }
    if (n.type === 'output') reg.set('outputnode', n.id);
    if (n.type === 'text') reg.set('textnode', n.id);
    if (n.type === 'end') reg.set('endnode', n.id);
  }
  return reg;
}

function resolveNodeRef(ref: string, nodes: Node[], registry: Map<string, string>): string | null {
  const bare = ref.split('.')[0].toLowerCase();
  const fromReg = registry.get(bare);
  if (fromReg) return fromReg;

  const exact = nodes.find((n) => n.id === ref);
  if (exact) return exact.id;

  const ci = nodes.find((n) => n.id.toLowerCase() === bare);
  if (ci) return ci.id;

  const partial = nodes.filter((n) => n.id.toLowerCase().includes(bare));
  if (partial.length === 1) return partial[0].id;

  const byType = mapNodeType(bare);
  if (byType) {
    const typed = nodes.filter((n) => n.type === byType);
    if (typed.length === 1) return typed[0].id;
    if (typed.length > 1) return typed[typed.length - 1].id;
  }

  return null;
}

/** Thực thi action lên graph hiện tại. */
export function applyWorkflowActions(
  actions: WorkflowAgentAction[],
  nodes: Node[],
  edges: Edge[],
): ApplyResult {
  let nextNodes = [...nodes];
  let nextEdges = [...edges];
  const applied: WorkflowAgentAction[] = [];
  const registry = buildRefRegistry(nextNodes);
  let addIndex = nextNodes.length;
  let focusView = false;

  for (const action of actions) {
    switch (action.kind) {
      case 'delete_all':
        nextNodes = [];
        nextEdges = [];
        registry.clear();
        addIndex = 0;
        applied.push(action);
        break;

      case 'delete_node': {
        const id = action.nodeId;
        if (!id) break;
        nextNodes = nextNodes.filter((n) => n.id !== id);
        nextEdges = nextEdges.filter((e) => e.source !== id && e.target !== id);
        for (const [k, v] of [...registry.entries()]) {
          if (v === id) registry.delete(k);
        }
        applied.push(action);
        break;
      }

      case 'replace_graph':
        if (action.nodes) {
          nextNodes = normalizeLayoutNodes(action.nodes);
          nextEdges = (action.edges ?? []).map((e) => ({ ...e, type: e.type ?? 'wf' }));
          registry.clear();
          for (const n of nextNodes) {
            const r = buildRefRegistry([n]);
            r.forEach((v, k) => registry.set(k, v));
          }
          applied.push(action);
        }
        break;

      case 'add_node': {
        const type = action.nodeType ?? mapNodeType(action.label.replace(/^Add\s+/i, ''));
        if (!type || !VALID_NODE_TYPES.has(type)) break;
        const id = action.nodeId ?? nextNodeId(type);
        const position = action.position ?? defaultPosition(type, addIndex);
        const node: Node = {
          id,
          type,
          position,
          data: { ...(action.data ?? {}) },
        };
        nextNodes.push(node);
        registry.set(id.toLowerCase(), id);
        registry.set(type, id);
        if (action.nodeRef) registry.set(action.nodeRef.toLowerCase(), id);
        registry.set(defaultNodeRef(type), id);
        addIndex += 1;
        applied.push({ ...action, nodeId: id });
        break;
      }

      case 'connect': {
        if (!action.source || !action.target) break;
        const source = resolveNodeRef(action.source, nextNodes, registry);
        const target = resolveNodeRef(action.target, nextNodes, registry);
        if (!source || !target) break;
        const edgeId = `e_${source}_${target}_${action.sourceHandle ?? 'out'}_${action.targetHandle ?? 'in'}`;
        if (nextEdges.some((e) => e.id === edgeId)) {
          applied.push(action);
          break;
        }
        nextEdges.push({
          id: edgeId,
          source,
          target,
          sourceHandle: action.sourceHandle,
          targetHandle: action.targetHandle,
          type: 'wf',
        });
        applied.push(action);
        break;
      }

      case 'update_node': {
        const id =
          (action.nodeId && resolveNodeRef(action.nodeId, nextNodes, registry)) ?? action.nodeId;
        if (!id || !action.data) break;
        nextNodes = nextNodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, ...action.data } } : n,
        );
        applied.push(action);
        break;
      }

      case 'focus_view':
        focusView = true;
        applied.push(action);
        break;

      default:
        break;
    }
  }

  return { nodes: nextNodes, edges: nextEdges, applied, focusView };
}
```

---

## src/components/workflow/WorkflowMediaInputModal.tsx

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Loader2, Search, Trash2, Upload, Video, X } from 'lucide-react';
import { getGommoClient, loadAuth } from '../../services/authStore';
import {
  feedMediaUrl,
  feedModelLabel,
  feedThumb,
  fetchMyImages,
  fetchMyVideos,
  type FeedItem,
} from '../../services/feedApi';
import {
  MEDIA_INPUT_PORTS,
  type MediaInputDraft,
  type MediaInputKind,
  type MediaSourceTab,
} from '../../services/workflowMediaInput';

function tsToDate(value: string | number | undefined): Date | null {
  if (value == null) return null;
  let ts = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(ts) || ts <= 0) return null;
  if (ts < 1e12) ts *= 1000;
  return new Date(ts);
}

function dayLabel(d: Date): string {
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

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
  { id: 'upload', label: 'Chọn file' },
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
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const [libraryItems, setLibraryItems] = useState<FeedItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState('');
  const [libraryQuery, setLibraryQuery] = useState('');
  const [libraryAfterId, setLibraryAfterId] = useState('');
  const [libraryHasMore, setLibraryHasMore] = useState(true);
  const libraryLoadingRef = useRef(false);

  useEffect(() => {
    if (open) {
      setDraft(initialDraft);
      setUrlInput('');
      setError('');
      setLibraryQuery('');
    }
  }, [open, initialDraft]);

  const loadLibrary = useCallback(
    async (after: string, reset: boolean) => {
      if (!loadAuth()?.access_token) {
        setLibraryError('Cần đăng nhập để xem thư viện.');
        setLibraryItems([]);
        setLibraryHasMore(false);
        return;
      }
      if (libraryLoadingRef.current) return;
      libraryLoadingRef.current = true;
      setLibraryLoading(true);
      if (reset) setLibraryError('');
      try {
        const fetcher = kind === 'image' ? fetchMyImages : fetchMyVideos;
        const page = await fetcher({ limit: 30, afterId: after });
        setLibraryItems((prev) => (reset ? page.items : [...prev, ...page.items]));
        setLibraryAfterId(page.nextAfterId);
        setLibraryHasMore(Boolean(page.nextAfterId) && page.items.length > 0);
      } catch (err) {
        setLibraryError(err instanceof Error ? err.message : String(err));
        if (reset) {
          setLibraryItems([]);
          setLibraryHasMore(false);
        }
      } finally {
        libraryLoadingRef.current = false;
        setLibraryLoading(false);
      }
    },
    [kind],
  );

  useEffect(() => {
    if (!open || draft.sourceTab !== 'library') return;
    setLibraryItems([]);
    setLibraryAfterId('');
    setLibraryHasMore(true);
    void loadLibrary('', true);
  }, [open, draft.sourceTab, kind, loadLibrary]);

  if (!open) return null;

  const tabs = kind === 'image' ? IMAGE_TABS : VIDEO_TABS;
  const ports = MEDIA_INPUT_PORTS[kind];
  const title = kind === 'image' ? 'Nhập ảnh' : 'Nhập Video';
  const desc =
    kind === 'image'
      ? 'Chỉ ảnh (URL, tải lên). Cổng "Gộp ảnh" để nối nhiều nguồn ảnh vào cùng danh sách.'
      : 'Video (tải lên/album/URL). Cổng "Gộp video" để nối nhiều luồng video vào cùng danh sách.';

  const accept = kind === 'image' ? 'image/*' : 'video/*';

  const filteredLibrary = libraryItems.filter((item) => {
    const url = feedMediaUrl(item);
    if (!url) return false;
    const q = libraryQuery.trim().toLowerCase();
    if (!q) return true;
    return [item.prompt, feedModelLabel(item), item.id_base]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  });

  const libraryGroups = (() => {
    const map = new Map<string, FeedItem[]>();
    for (const item of filteredLibrary) {
      const d = tsToDate(item.created_time);
      const label = d ? dayLabel(d) : 'Khác';
      const list = map.get(label) ?? [];
      list.push(item);
      map.set(label, list);
    }
    return [...map.entries()];
  })();

  const addUrl = (url: string, label?: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setDraft((d) => {
      if (d.mediaUrls.includes(trimmed)) return d;
      return {
        ...d,
        mediaUrls: [...d.mediaUrls, trimmed],
        fileNames: [...d.fileNames, label || trimmed],
      };
    });
    setUrlInput('');
  };

  const addLibraryItem = (item: FeedItem) => {
    const url = feedMediaUrl(item);
    if (!url) return;
    const label = item.prompt?.trim() || feedModelLabel(item) || item.id_base || url;
    addUrl(url, label);
  };

  const removeUrl = (index: number) => {
    setDraft((d) => ({
      ...d,
      mediaUrls: d.mediaUrls.filter((_, i) => i !== index),
      fileNames: d.fileNames.filter((_, i) => i !== index),
    }));
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    const valid =
      kind === 'image'
        ? file.type.startsWith('image/')
        : file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(file.name);
    if (!valid) {
      setError(kind === 'image' ? 'Chỉ chấp nhận file ảnh' : 'Chỉ chấp nhận file video');
      return;
    }
    if (!loadAuth()?.access_token) {
      setError('Cần đăng nhập để upload');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const client = getGommoClient();
      const { url } =
        kind === 'image' ? await client.uploadImage(file) : await client.uploadVideo(file);
      setDraft((d) => ({
        ...d,
        mediaUrls: [...d.mediaUrls, url],
        fileNames: [...d.fileNames, file.name],
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
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

  return (
    <div className="wf-media-modal-overlay" onClick={onClose}>
      <div className="wf-media-modal" onClick={(e) => e.stopPropagation()}>
        <header className="wf-media-modal-head">
          <div className="wf-media-modal-title">
            {kind === 'image' ? <Image size={18} /> : <Video size={18} />}
            <h3>{title}</h3>
          </div>
          <button type="button" className="wf-media-modal-x" onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </header>

        <p className="wf-media-modal-desc">{desc}</p>

        <div className="wf-media-modal-tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={draft.sourceTab === t.id ? 'active' : ''}
              onClick={() => setDraft((d) => ({ ...d, sourceTab: t.id }))}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="wf-media-modal-body">
          {draft.sourceTab === 'upload' && (
            <div
              className="wf-media-modal-upload"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void handleUpload(e.dataTransfer.files[0]);
              }}
            >
              <Upload size={22} />
              <p>Kéo thả hoặc chọn file</p>
              <button
                type="button"
                className="wf-media-modal-upload-btn"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? 'Đang tải…' : tabs[0].label}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept={accept}
                multiple
                className="sr-only"
                onChange={(e) => void handleUpload(e.target.files?.[0])}
              />
            </div>
          )}

          {draft.sourceTab === 'library' && (
            <div className="wf-media-modal-library">
              <div className="wf-media-modal-library-search">
                <Search size={14} />
                <input
                  type="text"
                  value={libraryQuery}
                  onChange={(e) => setLibraryQuery(e.target.value)}
                  placeholder="Tìm kiếm theo prompt…"
                />
              </div>

              {libraryError && <p className="wf-media-modal-error">{libraryError}</p>}

              {libraryLoading && libraryItems.length === 0 ? (
                <p className="wf-media-modal-empty">
                  <Loader2 size={16} className="wf-spin" /> Đang tải thư viện…
                </p>
              ) : filteredLibrary.length === 0 ? (
                <p className="wf-media-modal-empty">
                  {libraryQuery.trim()
                    ? 'Không tìm thấy kết quả.'
                    : `Chưa có ${kind === 'image' ? 'ảnh' : 'video'} trong thư viện.`}
                </p>
              ) : (
                <div className="wf-media-modal-library-scroll">
                  {libraryGroups.map(([date, items]) => (
                    <div key={date} className="wf-media-modal-library-day">
                      <span className="wf-media-modal-library-date">{date}</span>
                      <div className="wf-media-modal-library-grid">
                        {items.map((item) => {
                          const url = feedMediaUrl(item)!;
                          const thumb = feedThumb(item) || url;
                          const selected = draft.mediaUrls.includes(url);
                          return (
                            <button
                              key={item.id_base}
                              type="button"
                              className={`wf-media-lib-item${selected ? ' selected' : ''}`}
                              onClick={() => addLibraryItem(item)}
                              title={item.prompt || feedModelLabel(item) || url}
                            >
                              {kind === 'image' ? (
                                <img src={thumb} alt="" />
                              ) : (
                                <video src={thumb} muted preload="metadata" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {libraryHasMore && filteredLibrary.length > 0 && (
                <button
                  type="button"
                  className="wf-media-modal-library-more"
                  disabled={libraryLoading}
                  onClick={() => void loadLibrary(libraryAfterId, false)}
                >
                  {libraryLoading ? (
                    <>
                      <Loader2 size={14} className="wf-spin" /> Đang tải…
                    </>
                  ) : (
                    'Tải thêm'
                  )}
                </button>
              )}

              <p className="wf-media-modal-library-hint">
                Click vào {kind === 'image' ? 'ảnh' : 'video'} để chọn
              </p>
            </div>
          )}

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

          {draft.mediaUrls.length > 0 && (
            <ul className="wf-media-modal-list">
              {draft.mediaUrls.map((url, i) => (
                <li key={`${url}-${i}`}>
                  <span title={url}>{draft.fileNames[i] || url}</span>
                  <button type="button" onClick={() => removeUrl(i)}>
                    Xóa
                  </button>
                </li>
              ))}
            </ul>
          )}

          {error && <p className="wf-media-modal-error">{error}</p>}
        </div>

        <section className="wf-media-modal-settings">
          <h4>SETTINGS</h4>
          <label className="wf-media-toggle">
            <input
              type="checkbox"
              checked={draft.randomOutput}
              onChange={(e) => setDraft((d) => ({ ...d, randomOutput: e.target.checked }))}
            />
            <span>
              <strong>Random Output</strong>
              <small>
                {kind === 'image'
                  ? 'Mỗi lần chạy sẽ random chọn ảnh trong khoảng đã chọn.'
                  : 'Mỗi lần chạy sẽ random chọn video trong khoảng đã chọn.'}
              </small>
            </span>
          </label>
          <label className="wf-media-toggle">
            <input
              type="checkbox"
              checked={draft.useOnce}
              onChange={(e) => setDraft((d) => ({ ...d, useOnce: e.target.checked }))}
            />
            <span>
              <strong>Chỉ dùng 1 lần</strong>
              <small>
                {kind === 'image'
                  ? 'Mỗi ảnh chỉ được dùng 1 lần, sau khi dùng sẽ bị khóa.'
                  : 'Mỗi video chỉ được dùng 1 lần, sau khi dùng sẽ bị khóa.'}
              </small>
            </span>
          </label>
        </section>

        <section className="wf-media-modal-ports">
          <h4>CỔNG KẾT NỐI</h4>
          <div className="wf-media-modal-ports-grid">
            <div>
              <span className="wf-media-ports-label">Đầu vào</span>
              {ports.in.map((p) => (
                <div key={p.id} className="wf-media-port-row">
                  <span className="wf-media-port-dot" style={{ background: p.color }} />
                  {p.label}
                  <code>{p.id}</code>
                </div>
              ))}
            </div>
            <div>
              <span className="wf-media-ports-label">Đầu ra</span>
              {ports.out.map((p) => (
                <div key={p.id} className="wf-media-port-row">
                  <span className="wf-media-port-dot" style={{ background: p.color }} />
                  {p.label}
                  <code>{p.id}</code>
                </div>
              ))}
            </div>
          </div>
        </section>

        <footer className="wf-media-modal-foot">
          {!isNew && (
            <button type="button" className="wf-media-modal-delete" onClick={onDelete}>
              <Trash2 size={14} />
              Xóa Node
            </button>
          )}
          <label className="wf-media-modal-required">
            <input
              type="checkbox"
              checked={draft.required}
              onChange={(e) => setDraft((d) => ({ ...d, required: e.target.checked }))}
            />
            Bắt buộc
          </label>
          <button type="button" className="wf-media-modal-done" onClick={handleDone}>
            Xong
          </button>
        </footer>
      </div>
    </div>
  );
}
```

---

## src/components/workflow/WorkflowAgentPanel.tsx

```tsx
import { useEffect, useRef, useState } from 'react';
import {
  Bot,
  ChevronRight,
  Clock,
  MessageCircle,
  MessageSquarePlus,
  Send,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import type { Edge, Node } from '@xyflow/react';
import WorkflowAgentChatSettingsModal from './WorkflowAgentChatSettingsModal';
import WorkflowAgentSettingsModal from './WorkflowAgentSettingsModal';
import {
  getActiveSession,
  loadAgentState,
  makeSession,
  resolveAgentChatModel,
  saveAgentState,
  type AgentMessage,
  type AgentState,
} from '../../services/workflowAgentStore';
import { askGommo, isGommoChatConfigured, type ChatTurn } from '../../services/gommoChat';
import {
  applyWorkflowActions,
  buildWorkflowSnapshot,
  parseAgentActions,
} from '../../services/workflowAgentActions';
import { formatAgentDisplayContent } from '../../services/agentDisplayContent';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tabName: string;
  nodes: Node[];
  edges: Edge[];
  onApplyGraph: (nodes: Node[], edges: Edge[], opts?: { focusView?: boolean }) => void;
}

function countInteractions(messages: AgentMessage[]): number {
  return messages.filter((m) => m.role === 'user').length;
}

export default function WorkflowAgentPanel({
  open,
  onOpenChange,
  tabName,
  nodes,
  edges,
  onApplyGraph,
}: Props) {
  const [state, setState] = useState<AgentState>(() => loadAgentState());
  const [input, setInput] = useState('');
  const [chatSettingsOpen, setChatSettingsOpen] = useState(false);
  const [directSettingsOpen, setDirectSettingsOpen] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const session = getActiveSession(state);
  const interactions = countInteractions(session.messages);

  useEffect(() => {
    saveAgentState(state);
  }, [state]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [session.messages, thinking]);

  const persist = (next: AgentState) => setState(next);

  const patchAssistant = (
    sessionId: string,
    msgId: string,
    patch: Partial<AgentMessage>,
  ) => {
    setState((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              messages: s.messages.map((m) => (m.id === msgId ? { ...m, ...patch } : m)),
            }
          : s,
      ),
    }));
  };

  const newSession = () => {
    const s = makeSession();
    persist({
      ...state,
      sessions: [s, ...state.sessions],
      activeSessionId: s.id,
    });
    setHistoryOpen(false);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || thinking) return;

    if (!isGommoChatConfigured()) {
      window.alert('Bạn cần đăng nhập (Access Token Gommo) để chat với Agent.');
      return;
    }

    setInput('');

    const now = Date.now();
    const userMsg: AgentMessage = {
      id: `msg_${now}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    const assistantMsg: AgentMessage = {
      id: `msg_${now}_a`,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
    };

    const history: ChatTurn[] = session.messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      text: m.content,
    }));
    const firstTurn = interactions === 0;
    const snapshot = buildWorkflowSnapshot(tabName, nodes, edges);

    setState((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) =>
        s.id === session.id ? { ...s, messages: [...s.messages, userMsg, assistantMsg] } : s,
      ),
    }));
    setThinking(true);

    let acc = '';
    const chatModel = resolveAgentChatModel(state.chatModelId);
    try {
      await askGommo(text, {
        history,
        firstTurn,
        sessionId: session.id,
        workflowSnapshot: snapshot,
        config: { model: chatModel.model, server: chatModel.server },
        onDelta: (chunk) => {
          acc += chunk;
          patchAssistant(session.id, assistantMsg.id, { content: acc });
        },
      });

      if (!acc.trim()) {
        patchAssistant(session.id, assistantMsg.id, {
          content: '(Agent không trả về nội dung.)',
        });
        return;
      }

      const actions = parseAgentActions(acc, text, nodes);
      let actionsApplied = false;
      let appliedCount: number | undefined;

      if (state.autoMode && actions.length > 0) {
        const result = applyWorkflowActions(actions, nodes, edges);
        onApplyGraph(result.nodes, result.edges, { focusView: result.focusView });
        actionsApplied = result.applied.length > 0;
        appliedCount = result.applied.length;
      }

      patchAssistant(session.id, assistantMsg.id, {
        content: acc,
        actions: actions.length ? actions : undefined,
        actionsApplied,
        appliedCount,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      patchAssistant(session.id, assistantMsg.id, { content: `⚠️ Lỗi: ${msg}` });
    } finally {
      setThinking(false);
    }
  };

  const renderContent = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part.split('\n').map((line, j, arr) => (
        <span key={`${i}-${j}`}>
          {line}
          {j < arr.length - 1 && <br />}
        </span>
      ));
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        className="wf-agent-fab"
        onClick={() => onOpenChange(true)}
        title="Mở Workflow Agent"
      >
        <MessageCircle size={22} />
      </button>
    );
  }

  return (
    <>
      <aside className="wf-agent-panel">
        <div className="wf-agent-head">
          <div className="wf-agent-head-left">
            <span className="wf-agent-logo">
              <Bot size={18} />
            </span>
            <div>
              <div className="wf-agent-title">Moon Agent</div>
              <div className="wf-agent-meta">
                {tabName} · {nodes.length} nodes · {edges.length} connections · 0 groups
              </div>
            </div>
          </div>
          <div className="wf-agent-head-actions">
            <button
              type="button"
              className="wf-agent-head-btn icon-only"
              onClick={newSession}
              title="Phiên mới"
            >
              <MessageSquarePlus size={16} />
            </button>
            <button
              type="button"
              className={`wf-agent-head-btn icon-only${historyOpen ? ' active' : ''}`}
              onClick={() => setHistoryOpen((v) => !v)}
              title="Lịch sử"
            >
              <Clock size={16} />
            </button>
            <button
              type="button"
              className="wf-agent-head-btn icon-only"
              onClick={() => setChatSettingsOpen(true)}
              title="Cài đặt model chat"
            >
              <SlidersHorizontal size={16} />
            </button>
            <button
              type="button"
              className="wf-agent-head-btn icon-only"
              onClick={() => onOpenChange(false)}
              title="Đóng"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {historyOpen && (
          <div className="wf-agent-history">
            {state.sessions.map((s) => (
              <button
                key={s.id}
                type="button"
                className={s.id === session.id ? 'active' : ''}
                onClick={() => {
                  persist({ ...state, activeSessionId: s.id });
                  setHistoryOpen(false);
                }}
              >
                {s.name}
                <ChevronRight size={14} />
              </button>
            ))}
          </div>
        )}

        <div className="wf-agent-messages" ref={listRef}>
          {session.messages.map((m) => {
            const isEmptyStreaming = m.role === 'assistant' && !m.content;
            const displayText =
              m.role === 'assistant' && m.content
                ? formatAgentDisplayContent(m.content)
                : m.content;
            const showBubble =
              isEmptyStreaming || (displayText.trim().length > 0 && !displayText.startsWith('('));
            return (
              <div key={m.id} className={`wf-agent-msg wf-agent-msg--${m.role}`}>
                {m.role === 'assistant' && (
                  <span className="wf-agent-msg-avatar">
                    <Bot size={14} />
                  </span>
                )}
                <div className="wf-agent-msg-body">
                  {showBubble && (
                    <div
                      className={`wf-agent-bubble${isEmptyStreaming ? ' wf-agent-bubble--typing' : ''}`}
                    >
                      {isEmptyStreaming ? 'Đang suy nghĩ…' : renderContent(displayText)}
                    </div>
                  )}
                  {m.actions && m.actions.length > 0 && (
                    <div className="wf-agent-actions">
                      <div className="wf-agent-actions-title">Action dự kiến</div>
                      <ul>
                        {m.actions.map((a, i) => (
                          <li key={i}>{a.label}</li>
                        ))}
                      </ul>
                      {m.actionsApplied && (
                        <div className="wf-agent-applied">
                          Đã áp dụng {m.appliedCount ?? m.actions.length} action vào template hiện
                          tại
                        </div>
                      )}
                      {!m.actionsApplied && state.autoMode && (
                        <div className="wf-agent-applied muted">Không có action nào được apply</div>
                      )}
                      {!state.autoMode && !m.actionsApplied && (
                        <button
                          type="button"
                          className="wf-agent-apply-btn"
                          onClick={() => {
                            const result = applyWorkflowActions(m.actions!, nodes, edges);
                            onApplyGraph(result.nodes, result.edges, { focusView: result.focusView });
                            patchAssistant(session.id, m.id, {
                              actionsApplied: true,
                              appliedCount: result.applied.length,
                            });
                          }}
                        >
                          Áp dụng lên canvas
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="wf-agent-compose">
          <p className="wf-agent-scope">
            Workflow Agent đang chỉnh sửa scope template hiện tại
          </p>
          <textarea
            className="wf-agent-input"
            rows={3}
            placeholder="Mô tả workflow bạn muốn Agent tạo, sửa hoặc tối ưu…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <div className="wf-agent-compose-bar">
            <button
              type="button"
              className="wf-agent-icon-btn"
              onClick={() => setDirectSettingsOpen(true)}
              title="Cài đặt tạo trực tiếp"
            >
              <SlidersHorizontal size={16} />
            </button>
            <button
              type="button"
              className={`wf-agent-auto${state.autoMode ? ' on' : ''}`}
              onClick={() => persist({ ...state, autoMode: !state.autoMode })}
            >
              <Sparkles size={14} />
              Auto: {state.autoMode ? 'Bật' : 'Tắt'}
            </button>
            <button
              type="button"
              className="wf-agent-send"
              onClick={() => void send()}
              disabled={!input.trim() || thinking}
              title="Gửi"
            >
              <Send size={16} />
              Gửi
            </button>
          </div>
        </div>
      </aside>

      <WorkflowAgentChatSettingsModal
        open={chatSettingsOpen}
        modelId={state.chatModelId}
        onSave={(chatModelId) => persist({ ...state, chatModelId })}
        onClose={() => setChatSettingsOpen(false)}
      />

      <WorkflowAgentSettingsModal
        open={directSettingsOpen}
        settings={state.directCreate}
        onSave={(directCreate) => persist({ ...state, directCreate })}
        onClose={() => setDirectSettingsOpen(false)}
      />
    </>
  );
}
```

---

## src/components/WorkflowLibrary.tsx

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, FolderOpen, Play, Plus, Save, Search, Settings2, Trash2, Upload, X } from 'lucide-react';
import {
  assignTemplateToGroup,
  countByGroup,
  createGroup,
  deleteGroup,
  deleteTemplate,
  listTemplates,
  loadGroups,
  onLibraryUpdated,
  saveTemplate,
  updateGroup,
  WORKFLOW_GROUP_COLORS,
  type SavedTemplate,
  type TemplateGraph,
  type WorkflowGroup,
} from '../services/workflowLibraryStore';
import { parseWflFile } from '../services/wflImport';

interface Props {
  open: boolean;
  currentGraph: () => TemplateGraph;
  onOpenTemplate: (t: SavedTemplate) => void;
  onClose: () => void;
}

export default function WorkflowLibrary({ open, currentGraph, onOpenTemplate, onClose }: Props) {
  const [tick, setTick] = useState(0);
  const [query, setQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [importError, setImportError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => onLibraryUpdated(() => setTick((t) => t + 1)), []);

  const groups = useMemo(() => loadGroups(), [tick, open]);
  const counts = useMemo(() => countByGroup(), [tick, open]);
  const allTemplates = useMemo(() => listTemplates(null), [tick, open]);

  const templates = useMemo(() => {
    const base = activeGroup ? allTemplates.filter((t) => t.groupId === activeGroup) : allTemplates;
    const q = query.trim().toLowerCase();
    return q ? base.filter((t) => t.name.toLowerCase().includes(q)) : base;
  }, [allTemplates, activeGroup, query]);

  if (!open) return null;

  const handleSaveCurrent = () => {
    const graph = currentGraph();
    if (!graph.nodes.length) {
      window.alert('Canvas đang trống — chưa có gì để lưu.');
      return;
    }
    const name = newName.trim() || `Workflow ${new Date().toLocaleString('vi-VN')}`;
    saveTemplate(name, graph, activeGroup);
    setNewName('');
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    setImportError('');
    try {
      const raw = await file.text();
      const { name, graph } = parseWflFile(raw);
      if (!graph.nodes.length) {
        setImportError('File không có node nào.');
        return;
      }
      const baseName = name || file.name.replace(/\.(wfl|json)$/i, '');
      saveTemplate(baseName, graph, activeGroup);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return createPortal(
    <div className="wflib-overlay" onClick={onClose}>
      <div className="wflib-modal" onClick={(e) => e.stopPropagation()}>
        <header className="wflib-head">
          <div className="wflib-head-icon">
            <FolderOpen size={20} />
          </div>
          <div className="wflib-head-text">
            <span className="wflib-eyebrow">AUTO WORKFLOW</span>
            <h2>Thư viện Workflow</h2>
            <p>Lưu, gom nhóm và mở lại nhanh các workflow đã tạo.</p>
          </div>
          <button type="button" className="wflib-close" onClick={onClose} title="Đóng">
            <X size={18} />
          </button>
        </header>

        <div className="wflib-stats">
          <div className="wflib-stat">
            <span className="wflib-stat-label">Workflow</span>
            <span className="wflib-stat-value">{allTemplates.length}</span>
          </div>
          <div className="wflib-stat">
            <span className="wflib-stat-label">Nhóm</span>
            <span className="wflib-stat-value">{groups.length}</span>
          </div>
        </div>

        <div className="wflib-actions">
          <div className="wflib-search">
            <Search size={15} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm workflow…"
            />
          </div>
          <input
            type="text"
            className="wflib-name-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Tên workflow hiện tại…"
          />
          <button type="button" className="wflib-save-btn" onClick={handleSaveCurrent}>
            <Save size={15} /> Lưu workflow hiện tại
          </button>
          <button
            type="button"
            className="wflib-import-btn"
            onClick={() => fileRef.current?.click()}
            title="Import file .wfl / .json"
          >
            <Upload size={15} /> Import file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".wfl,.json,application/json"
            className="sr-only"
            onChange={(e) => void handleImportFile(e.target.files?.[0])}
          />
        </div>

        {importError && <div className="wflib-import-error">{importError}</div>}

        <div className="wflib-tabs">
          <button
            type="button"
            className={`wflib-tab${activeGroup === null ? ' active' : ''}`}
            onClick={() => setActiveGroup(null)}
          >
            Tất cả <span className="wflib-tab-count">{allTemplates.length}</span>
          </button>
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              className={`wflib-tab${activeGroup === g.id ? ' active' : ''}`}
              onClick={() => setActiveGroup(g.id)}
            >
              <span className="wflib-dot" style={{ background: g.color }} />
              {g.name} <span className="wflib-tab-count">{counts[g.id] ?? 0}</span>
            </button>
          ))}
          <button
            type="button"
            className="wflib-tab wflib-manage"
            onClick={() => setManageOpen(true)}
            title="Quản lý nhóm"
          >
            <Settings2 size={14} /> Quản lý nhóm
          </button>
        </div>

        <div className="wflib-grid">
          {templates.length === 0 && (
            <div className="wflib-empty">
              Chưa có workflow nào{activeGroup ? ' trong nhóm này' : ''}. Lưu workflow hiện tại để
              bắt đầu.
            </div>
          )}
          {templates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              groups={groups}
              onOpen={() => {
                onOpenTemplate(t);
                onClose();
              }}
            />
          ))}
        </div>

        {manageOpen && <ManageGroups groups={groups} onClose={() => setManageOpen(false)} />}
      </div>
    </div>,
    document.body,
  );
}

function TemplateCard({
  template,
  groups,
  onOpen,
}: {
  template: SavedTemplate;
  groups: WorkflowGroup[];
  onOpen: () => void;
}) {
  const group = groups.find((g) => g.id === template.groupId) || null;
  return (
    <div className="wflib-card">
      <div className="wflib-card-thumb" style={group ? { borderColor: group.color } : undefined}>
        <FolderOpen size={26} />
        {group && <span className="wflib-card-tag" style={{ background: group.color }} />}
      </div>
      <div className="wflib-card-body">
        <div className="wflib-card-name" title={template.name}>
          {template.name}
        </div>
        <div className="wflib-card-meta">{template.nodeCount} node</div>
        <div className="wflib-card-row">
          <select
            className="wflib-card-group"
            value={template.groupId ?? ''}
            onChange={(e) => assignTemplateToGroup(template.id, e.target.value || null)}
          >
            <option value="">Chưa phân nhóm</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="wflib-card-actions">
        <button type="button" className="wflib-card-open" onClick={onOpen}>
          <Play size={13} /> Mở
        </button>
        <button
          type="button"
          className="wflib-card-del"
          title="Xóa"
          onClick={() => {
            if (window.confirm(`Xóa workflow "${template.name}"?`)) deleteTemplate(template.id);
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function ManageGroups({ groups, onClose }: { groups: WorkflowGroup[]; onClose: () => void }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(WORKFLOW_GROUP_COLORS[0]);

  const create = () => {
    if (!name.trim()) return;
    createGroup(name, color);
    setName('');
  };

  return (
    <div className="wflib-sub-overlay" onClick={onClose}>
      <div className="wflib-sub" onClick={(e) => e.stopPropagation()}>
        <header className="wflib-sub-head">
          <div className="wflib-head-icon sm">
            <FolderOpen size={16} />
          </div>
          <div className="wflib-head-text">
            <h3>Quản lý nhóm Workflow</h3>
            <p>Tạo và quản lý nhóm để phân loại workflow.</p>
          </div>
          <button type="button" className="wflib-close" onClick={onClose} title="Đóng">
            <X size={16} />
          </button>
        </header>

        <div className="wflib-sub-create">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            placeholder="Tên nhóm mới…"
          />
          <div className="wflib-swatches">
            {WORKFLOW_GROUP_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`wflib-swatch${color === c ? ' active' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
              >
                {color === c && <Check size={12} />}
              </button>
            ))}
          </div>
          <button type="button" className="wflib-sub-add" onClick={create} disabled={!name.trim()}>
            <Plus size={15} />
          </button>
        </div>

        <div className="wflib-sub-list">
          {groups.length === 0 && <div className="wflib-empty sm">Chưa có nhóm nào.</div>}
          {groups.map((g) => (
            <GroupRow key={g.id} group={g} />
          ))}
        </div>
      </div>
    </div>
  );
}

function GroupRow({ group }: { group: WorkflowGroup }) {
  const counts = countByGroup();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);

  const commit = () => {
    updateGroup(group.id, { name });
    setEditing(false);
  };

  return (
    <div className="wflib-grp-row">
      <span className="wflib-dot" style={{ background: group.color }} />
      {editing ? (
        <input
          className="wflib-grp-edit"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
        />
      ) : (
        <button type="button" className="wflib-grp-name" onClick={() => setEditing(true)}>
          {group.name}
          <span className="wflib-grp-count">{counts[group.id] ?? 0} workflow</span>
        </button>
      )}
      <button
        type="button"
        className="wflib-card-del"
        title="Xóa nhóm"
        onClick={() => {
          if (window.confirm(`Xóa nhóm "${group.name}"? Workflow sẽ về "chưa phân nhóm".`))
            deleteGroup(group.id);
        }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
```

---

## src/services/workflowAgentStore.ts

```typescript
import { authUserKey } from './authStore';
import type { WorkflowAgentAction } from './workflowAgentActions';

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  /** Action dự kiến parse từ câu trả lời. */
  actions?: WorkflowAgentAction[];
  actionsApplied?: boolean;
  /** Số action đã apply (banner 79AI). */
  appliedCount?: number;
}

export interface DirectCreateSettings {
  kind: 'image' | 'video';
  model: string;
  ratio: string;
  resolution: string;
  duration: string;
  mode: string;
}

export interface AgentChatModel {
  id: string;
  name: string;
  desc: string;
  server: string;
  model: string;
}

/** Model chat Agent — khớp danh sách 79AI Moon Agent. */
export const AGENT_CHAT_MODELS = [
  {
    id: 'composer-2.5-standard',
    name: 'Composer 2.5 (Standard)',
    desc: 'cursorai · Cursor Composer 2.5: code nhanh, agent workflow, giá tiêu chuẩn.',
    server: 'cursorai',
    model: 'composer-2.5',
  },
  {
    id: 'composer-2.5-fast',
    name: 'Composer 2.5 (Fast)',
    desc: 'cursorai · Composer 2.5 Fast: phản hồi nhanh, phù hợp chỉnh workflow.',
    server: 'cursorai',
    model: 'composer-2.5-fast',
  },
  {
    id: 'gpt-5.5-cheap',
    name: 'GPT-5.5 Cheap',
    desc: 'openai · GPT-5.5 rẻ, cân bằng chất lượng và chi phí.',
    server: 'openai',
    model: 'gpt-5.5-cheap',
  },
  {
    id: 'deepseek-v4-pro',
    name: 'DeepSeek V4 Pro',
    desc: 'deepseek · DeepSeek V4 Pro: suy luận mạnh, prompt dài.',
    server: 'deepseek',
    model: 'deepseek-v4-pro',
  },
  {
    id: 'glm-5.2-vip',
    name: 'GLM-5.2 VIP',
    desc: 'zhipu · GLM-5.2 VIP: tiếng Việt tốt, agent đa bước.',
    server: 'zhipu',
    model: 'glm-5.2-vip',
  },
] as const satisfies readonly AgentChatModel[];

export type AgentChatModelId = (typeof AGENT_CHAT_MODELS)[number]['id'];

export function resolveAgentChatModel(modelId?: string): AgentChatModel {
  return AGENT_CHAT_MODELS.find((m) => m.id === modelId) ?? AGENT_CHAT_MODELS[1];
}

export interface AgentSession {
  id: string;
  name: string;
  messages: AgentMessage[];
  createdAt: string;
}

export interface AgentState {
  sessions: AgentSession[];
  activeSessionId: string;
  autoMode: boolean;
  chatModelId: AgentChatModelId;
  directCreate: DirectCreateSettings;
}

const EVENT = 'wf-agent:updated';

const DEFAULT_DIRECT: DirectCreateSettings = {
  kind: 'video',
  model: 'veo-omni',
  ratio: '16:9',
  resolution: '720p',
  duration: '4s',
  mode: 'Flash',
};

function userKey(): string {
  return authUserKey();
}

function storageKey(): string {
  return `ai_wf_agent:${userKey()}`;
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function welcomeMessage(): AgentMessage {
  return {
    id: newId('msg'),
    role: 'assistant',
    content:
      'Xin chào! Tôi là **Moon Agent** — giúp bạn tạo và chỉnh workflow trên canvas.\n\n' +
      'Mô tả workflow bạn muốn (vd: tạo ảnh từ prompt → xuất kết quả), tôi sẽ áp dụng lên canvas.',
    createdAt: new Date().toISOString(),
  };
}

export function makeSession(name?: string): AgentSession {
  return {
    id: newId('sess'),
    name: name || 'Phiên mới',
    messages: [welcomeMessage()],
    createdAt: new Date().toISOString(),
  };
}

function defaultState(): AgentState {
  const first = makeSession('Phiên 1');
  return {
    sessions: [first],
    activeSessionId: first.id,
    autoMode: true,
    chatModelId: 'composer-2.5-fast',
    directCreate: { ...DEFAULT_DIRECT },
  };
}

export function loadAgentState(): AgentState {
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as AgentState;
    if (!parsed.sessions?.length) return defaultState();
    return {
      ...defaultState(),
      ...parsed,
      chatModelId: resolveAgentChatModel(parsed.chatModelId).id,
      directCreate: { ...DEFAULT_DIRECT, ...parsed.directCreate },
    };
  } catch {
    return defaultState();
  }
}

export function saveAgentState(state: AgentState): void {
  localStorage.setItem(storageKey(), JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function onAgentUpdated(fn: () => void): () => void {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}

export function getActiveSession(state: AgentState): AgentSession {
  return state.sessions.find((s) => s.id === state.activeSessionId) ?? state.sessions[0];
}

/** Phản hồi mock — thay bằng LLM sau. */
export function mockAgentReply(
  userText: string,
  ctx: { nodeCount: number; edgeCount: number; tabName: string },
): string {
  const t = userText.toLowerCase();
  if (t.includes('ảnh') || t.includes('image')) {
    return (
      `Gợi ý workflow tạo ảnh cho tab **${ctx.tabName}**:\n\n` +
      `1. **Bắt đầu** → **Tạo ảnh** (prompt)\n` +
      `2. **Xử lý ảnh** (tuỳ chọn upscale)\n` +
      `3. **Kết quả**\n\n` +
      `Hiện canvas có **${ctx.nodeCount} node**, **${ctx.edgeCount}** kết nối. ` +
      `Bạn có thể kéo node từ palette bên trái hoặc mô tả chi tiết hơn để tôi gợi ý tiếp.`
    );
  }
  if (t.includes('video')) {
    return (
      `Workflow video gợi ý:\n\n` +
      `**Bắt đầu** → **Tạo video** → **Kết quả**\n\n` +
      `Cài đặt tạo trực tiếp (nút ⚙ cạnh Auto): model **${DEFAULT_DIRECT.model}**, ` +
      `tỷ lệ **${DEFAULT_DIRECT.ratio}**, **${DEFAULT_DIRECT.duration}**.`
    );
  }
  if (t.includes('tối ưu') || t.includes('toiuu') || t.includes('optimize')) {
    return (
      `Để tối ưu workflow hiện tại:\n\n` +
      `- Gom node liên tiếp không cần nhánh\n` +
      `- Dùng **Sắp xếp tự động** ở thanh dưới\n` +
      `- Kiểm tra mỗi node AI đã chọn model phù hợp\n\n` +
      `Canvas: **${ctx.nodeCount}** node, **${ctx.edgeCount}** edge.`
    );
  }
  return (
    `Đã nhận yêu cầu cho tab **${ctx.tabName}**.\n\n` +
    `Tôi đang ở chế độ demo — mô tả rõ hơn (tạo ảnh, video, điều kiện, lặp…) ` +
    `để nhận gợi ý workflow. Khi nối AI thật, tôi có thể đề xuất và chỉnh sơ đồ trực tiếp.`
  );
}

export const DIRECT_MODELS = {
  image: [
    { id: 'flux-pro', name: 'Flux Pro', desc: 'Tạo ảnh chất lượng cao, phù hợp prompt chi tiết.' },
    { id: 'sdxl', name: 'SDXL', desc: 'Model ổn định, nhanh cho ảnh tổng quát.' },
  ],
  video: [
    {
      id: 'veo-omni',
      name: 'VEO - Omni',
      desc: 'Model VEO Omni — tạo video thế hệ mới từ Google, hỗ trợ nhiều tỷ lệ.',
    },
    { id: 'kling', name: 'Kling', desc: 'Video ngắn chuyển động mượt, phù hợp social.' },
  ],
} as const;

export const DIRECT_RATIOS = ['16:9', '9:16'] as const;
export const DIRECT_RESOLUTIONS = ['720p', '1080p', '4k'] as const;
export const DIRECT_DURATIONS = ['4s', '6s', '8s', '10s'] as const;
export const DIRECT_MODES = ['Flash'] as const;
```

---

## src/services/workflowLibraryStore.ts

```typescript
import type { Edge, Node } from '@xyflow/react';
import { authUserKey } from './authStore';

export interface WorkflowGroup {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavedTemplate {
  id: string;
  name: string;
  groupId: string | null;
  nodes: Node[];
  edges: Edge[];
  nodeCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Dữ liệu graph tối thiểu để lưu một template. */
export interface TemplateGraph {
  nodes: Node[];
  edges: Edge[];
}

export const WORKFLOW_GROUP_COLORS = [
  '#2dd4bf',
  '#a78bfa',
  '#fbbf24',
  '#f87171',
  '#34d399',
  '#60a5fa',
  '#f472b6',
  '#fb923c',
];

const EVENT = 'wf-library:updated';

function userKey(): string {
  return authUserKey();
}

function groupsKey(): string {
  return `ai_wf_groups:${userKey()}`;
}

function templatesKey(): string {
  return `ai_wf_templates:${userKey()}`;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function dispatch(): void {
  document.dispatchEvent(new CustomEvent(EVENT));
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Bỏ trạng thái chạy (status/resultUrl…) khi lưu template. */
function stripRuntime(nodes: Node[]): Node[] {
  return nodes.map((n) => {
    const data = (n.data ?? {}) as Record<string, unknown>;
    const { status, statusText, resultUrl, error, ...rest } = data;
    void status;
    void statusText;
    void resultUrl;
    void error;
    return { id: n.id, type: n.type, position: n.position, data: rest } as Node;
  });
}

/* ---------- Groups ---------- */

export function loadGroups(): WorkflowGroup[] {
  const arr = readJson<WorkflowGroup[]>(groupsKey(), []);
  return Array.isArray(arr) ? arr : [];
}

function saveGroups(list: WorkflowGroup[]): void {
  localStorage.setItem(groupsKey(), JSON.stringify(list));
}

export function createGroup(name: string, color?: string): WorkflowGroup {
  const list = loadGroups();
  const now = new Date().toISOString();
  const group: WorkflowGroup = {
    id: newId('wfg'),
    name: name.trim() || 'Nhóm mới',
    color: color || WORKFLOW_GROUP_COLORS[list.length % WORKFLOW_GROUP_COLORS.length],
    createdAt: now,
    updatedAt: now,
  };
  saveGroups([group, ...list]);
  dispatch();
  return group;
}

export function updateGroup(
  id: string,
  patch: Partial<Pick<WorkflowGroup, 'name' | 'color'>>,
): void {
  const list = loadGroups().map((g) =>
    g.id === id
      ? {
          ...g,
          name: patch.name != null ? patch.name.trim() || g.name : g.name,
          color: patch.color ?? g.color,
          updatedAt: new Date().toISOString(),
        }
      : g,
  );
  saveGroups(list);
  dispatch();
}

export function deleteGroup(id: string): void {
  saveGroups(loadGroups().filter((g) => g.id !== id));
  // Template thuộc nhóm bị xóa thì chuyển về "chưa phân nhóm"
  const templates = loadTemplates().map((t) => (t.groupId === id ? { ...t, groupId: null } : t));
  saveTemplates(templates);
  dispatch();
}

/* ---------- Templates ---------- */

export function loadTemplates(): SavedTemplate[] {
  const arr = readJson<SavedTemplate[]>(templatesKey(), []);
  return Array.isArray(arr) ? arr : [];
}

function saveTemplates(list: SavedTemplate[]): void {
  localStorage.setItem(templatesKey(), JSON.stringify(list));
}

export function saveTemplate(
  name: string,
  graph: TemplateGraph,
  groupId: string | null = null,
): SavedTemplate {
  const nodes = stripRuntime(graph.nodes);
  const now = new Date().toISOString();
  const template: SavedTemplate = {
    id: newId('wft'),
    name: name.trim() || 'Workflow mới',
    groupId,
    nodes,
    edges: graph.edges,
    nodeCount: nodes.length,
    createdAt: now,
    updatedAt: now,
  };
  saveTemplates([template, ...loadTemplates()]);
  dispatch();
  return template;
}

export function renameTemplate(id: string, name: string): void {
  const list = loadTemplates().map((t) =>
    t.id === id ? { ...t, name: name.trim() || t.name, updatedAt: new Date().toISOString() } : t,
  );
  saveTemplates(list);
  dispatch();
}

export function deleteTemplate(id: string): void {
  saveTemplates(loadTemplates().filter((t) => t.id !== id));
  dispatch();
}

export function assignTemplateToGroup(id: string, groupId: string | null): void {
  const list = loadTemplates().map((t) =>
    t.id === id ? { ...t, groupId, updatedAt: new Date().toISOString() } : t,
  );
  saveTemplates(list);
  dispatch();
}

export function getTemplate(id: string): SavedTemplate | null {
  return loadTemplates().find((t) => t.id === id) ?? null;
}

export function listTemplates(groupId: string | null | undefined): SavedTemplate[] {
  const all = loadTemplates();
  const scoped = groupId ? all.filter((t) => t.groupId === groupId) : all;
  return scoped
    .slice()
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function countByGroup(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const t of loadTemplates()) {
    if (t.groupId) counts[t.groupId] = (counts[t.groupId] ?? 0) + 1;
  }
  return counts;
}

export function onLibraryUpdated(handler: () => void): () => void {
  document.addEventListener(EVENT, handler);
  return () => document.removeEventListener(EVENT, handler);
}
```

---

## src/services/wflImport.ts

```typescript
import type { Edge, Node } from '@xyflow/react';
import type { TemplateGraph } from './workflowLibraryStore';

/** Node theo định dạng file .wfl (79ai-workflow) export từ vmedia. */
interface WflNode {
  id: string;
  type: string;
  position?: { x: number; y: number };
  data?: Record<string, unknown>;
}

interface WflConnection {
  id?: string;
  sourceNodeId: string;
  sourcePortId?: string;
  targetNodeId: string;
  targetPortId?: string;
}

interface WflFile {
  type?: string;
  version?: number;
  name?: string;
  nodes?: WflNode[];
  connections?: WflConnection[];
}

export interface WflImportResult {
  name: string;
  graph: TemplateGraph;
}

/** Map type node WFL → type node nội bộ của app. */
const NODE_TYPE_MAP: Record<string, string> = {
  start: 'start',
  end: 'end',
  'image-input': 'input-image',
  'video-input': 'input-video',
  'generate-image': 'image',
  'generate-video': 'video',
  'generate-tts': 'tts',
  'generate-music': 'music',
  'render-video': 'render',
  output: 'output',
  note: 'note',
  'api-call': 'api',
};

const MEDIA_NODE_TYPES = new Set(['input-image', 'input-video']);

function isWflFile(value: unknown): value is WflFile {
  if (!value || typeof value !== 'object') return false;
  const v = value as WflFile;
  return Array.isArray(v.nodes);
}

/** Chuyển data node WFL sang data node nội bộ. */
function convertNodeData(type: string, data: Record<string, unknown>): Record<string, unknown> {
  const prompt = (data.prompt_text ?? data.prompt ?? '') as string;

  if (type === 'image' || type === 'video' || type === 'music') {
    return {
      prompt,
      modelId: (data.model as string) || '',
      ratio: data.ratio,
      resolution: data.resolution,
      mode: data.mode,
      duration: data.duration,
      _modelName: data.model_name,
    };
  }

  if (type === 'tts') {
    return { text: prompt, modelId: (data.model as string) || '' };
  }

  if (MEDIA_NODE_TYPES.has(type)) {
    const urls = Array.isArray(data.urls)
      ? (data.urls as string[])
      : data.url
        ? [data.url as string]
        : [];
    return {
      mediaUrls: urls,
      fileNames: urls.map(() => (data.label as string) || 'Đã import'),
      resultUrl: urls[0] || '',
      required: Boolean(data.required),
      configured: urls.length > 0,
      randomOutput: false,
      useOnce: false,
      sourceTab: 'url',
    };
  }

  if (type === 'note') {
    return { prompt };
  }

  if (type === 'render') {
    return {
      exportMode: data.export_mode,
      profile: data.profile,
      resolution: data.resolution,
    };
  }

  if (type === 'output') {
    return {
      action: data.action,
      mode: data.mode,
      gridCols: data.gridCols,
    };
  }

  return { ...data };
}

/** Xác định handle nguồn/đích dựa trên type node để React Flow nối đúng. */
function resolveHandles(
  sourceType: string | undefined,
  targetType: string | undefined,
): { sourceHandle?: string; targetHandle?: string } {
  const sourceHandle = sourceType && MEDIA_NODE_TYPES.has(sourceType) ? 'media-out' : undefined;
  const targetHandle = targetType && MEDIA_NODE_TYPES.has(targetType) ? 'media-in' : undefined;
  return { sourceHandle, targetHandle };
}

/** Parse chuỗi JSON file .wfl → graph nội bộ; throw nếu format sai. */
export function parseWflFile(raw: string): WflImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('File không phải JSON hợp lệ.');
  }
  if (!isWflFile(parsed)) {
    throw new Error('File không đúng định dạng workflow (thiếu danh sách nodes).');
  }

  const wfl = parsed;
  const typeById = new Map<string, string>();

  const nodes: Node[] = (wfl.nodes ?? []).map((n) => {
    const mappedType = NODE_TYPE_MAP[n.type] ?? n.type;
    typeById.set(n.id, mappedType);
    return {
      id: n.id,
      type: mappedType,
      position: n.position ?? { x: 0, y: 0 },
      data: convertNodeData(mappedType, n.data ?? {}),
    } as Node;
  });

  const edges: Edge[] = (wfl.connections ?? []).map((c, i) => {
    const { sourceHandle, targetHandle } = resolveHandles(
      typeById.get(c.sourceNodeId),
      typeById.get(c.targetNodeId),
    );
    return {
      id: c.id || `wfl-edge-${i}`,
      source: c.sourceNodeId,
      target: c.targetNodeId,
      sourceHandle,
      targetHandle,
      type: 'wf',
    } as Edge;
  });

  return {
    name: wfl.name?.trim() || 'Workflow import',
    graph: { nodes, edges },
  };
}
```

---

## src/services/workflowMediaInput.ts

```typescript
import type { Edge } from '@xyflow/react';
import { getGommoClient } from './authStore';

export type MediaInputKind = 'image' | 'video';
export type MediaSourceTab = 'upload' | 'library' | 'extra' | 'url';

export interface MediaInputDraft {
  sourceTab: MediaSourceTab;
  mediaUrls: string[];
  fileNames: string[];
  randomOutput: boolean;
  useOnce: boolean;
  required: boolean;
}

export function defaultMediaInputDraft(): MediaInputDraft {
  return {
    sourceTab: 'upload',
    mediaUrls: [],
    fileNames: [],
    randomOutput: false,
    useOnce: false,
    required: false,
  };
}

export function draftFromNodeData(data: Record<string, unknown>): MediaInputDraft {
  const urls = Array.isArray(data.mediaUrls) ? [...(data.mediaUrls as string[])] : [];
  const names = Array.isArray(data.fileNames) ? [...(data.fileNames as string[])] : [];
  const legacyUrl = String(data.resultUrl || '').trim();
  if (legacyUrl && !urls.includes(legacyUrl)) {
    urls.unshift(legacyUrl);
    names.unshift(String(data.fileName || legacyUrl));
  }
  return {
    sourceTab: (data.sourceTab as MediaSourceTab) || 'upload',
    mediaUrls: urls,
    fileNames: names,
    randomOutput: Boolean(data.randomOutput),
    useOnce: Boolean(data.useOnce),
    required: Boolean(data.required),
  };
}

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

export function pickMediaUrl(
  urls: string[],
  randomOutput: boolean,
  useOnce: boolean,
  usedSet: Set<string>,
): string {
  let pool = urls.filter((u) => u.trim());
  if (useOnce) pool = pool.filter((u) => !usedSet.has(u));
  if (!pool.length) return '';
  const picked = randomOutput ? pool[Math.floor(Math.random() * pool.length)] : pool[0];
  if (useOnce && picked) usedSet.add(picked);
  return picked;
}

export function collectInboundMediaUrls(
  nodeId: string,
  edges: Edge[],
  outputs: Record<string, string>,
  targetHandle: string,
): string[] {
  return edges
    .filter((e) => e.target === nodeId && (e.targetHandle ?? 'media-in') === targetHandle)
    .map((e) => outputs[e.source])
    .filter((u): u is string => Boolean(u && isHttpUrl(u)));
}

export function resolveMediaInputUrls(
  nodeId: string,
  data: Record<string, unknown>,
  edges: Edge[],
  outputs: Record<string, string>,
  usedSet: Set<string>,
): { primary: string; all: string[]; firstFrame?: string } {
  const draft = draftFromNodeData(data);
  const urls = [...draft.mediaUrls.filter(isHttpUrl)];
  urls.push(...collectInboundMediaUrls(nodeId, edges, outputs, 'media-in'));
  urls.push(...collectInboundMediaUrls(nodeId, edges, outputs, 'merge'));

  const unique = [...new Set(urls)];
  const primary = pickMediaUrl(unique, draft.randomOutput, draft.useOnce, usedSet);

  return {
    primary,
    all: unique,
    firstFrame: primary,
  };
}

/** Trích frame đầu từ video — fallback URL gốc nếu CORS/upload lỗi. */
export async function extractVideoFirstFrame(videoUrl: string): Promise<string> {
  try {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.src = videoUrl;
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error('Không tải được video'));
    });
    video.currentTime = Math.min(0.1, video.duration || 0.1);
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
    });
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 360;
    const ctx = canvas.getContext('2d');
    if (!ctx) return videoUrl;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) return videoUrl;
    const file = new File([blob], 'first-frame.jpg', { type: 'image/jpeg' });
    const { url } = await getGommoClient().uploadImage(file);
    return url;
  } catch {
    return videoUrl;
  }
}

export const MEDIA_INPUT_PORTS = {
  image: {
    in: [
      { id: 'trigger', label: 'Kích hoạt', color: '#22d3ee' },
      { id: 'media-in', label: 'Ảnh vào', color: '#c084fc' },
      { id: 'merge', label: 'Gộp ảnh', color: '#c084fc' },
    ],
    out: [
      { id: 'done', label: 'Xong', color: '#e5e7eb' },
      { id: 'media-out', label: 'Ảnh', color: '#c084fc' },
      { id: 'all', label: 'Tất cả ảnh', color: '#c084fc' },
    ],
  },
  video: {
    in: [
      { id: 'trigger', label: 'Kích hoạt', color: '#22d3ee' },
      { id: 'media-in', label: 'Video vào', color: '#60a5fa' },
      { id: 'merge', label: 'Gộp video', color: '#60a5fa' },
    ],
    out: [
      { id: 'done', label: 'Xong', color: '#e5e7eb' },
      { id: 'media-out', label: 'Video', color: '#60a5fa' },
      { id: 'first-frame', label: 'Frame đầu tiên', color: '#c084fc' },
    ],
  },
} as const;
```

---

## src/components/WorkflowTopBar.tsx

```tsx
import { useState } from 'react';
import { ChevronDown, FolderOpen, Home, Pin, Plus, Save, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getCreditsAi } from '../services/authStore';
import { useCreditsUpdated } from '../hooks/useCreditsUpdated';
import UserMenuDropdown from './user/UserMenuDropdown';
import type { WorkflowTab } from '../services/workflowTabsStore';

interface Props {
  tabs: WorkflowTab[];
  activeId: string;
  libraryCount: number;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
  onTogglePin: (id: string) => void;
  onOpenLibrary: () => void;
  saved: boolean;
  onSave: () => void;
  onClear: () => void;
}

export default function WorkflowTopBar({
  tabs,
  activeId,
  libraryCount,
  onSelect,
  onClose,
  onNew,
  onTogglePin,
  onOpenLibrary,
  saved,
  onSave,
  onClear,
}: Props) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [credits, setCredits] = useState(getCreditsAi());
  useCreditsUpdated(() => setCredits(getCreditsAi()));

  const activeTab = tabs.find((t) => t.id === activeId);

  return (
    <div className={`wf-topbar${collapsed ? ' collapsed' : ''}`}>
      {!collapsed && (
        <div className="wf-topbar-inner">
          <div className="wf-topbar-left">
            <button
              type="button"
              className="wf-tb-home"
              onClick={() => navigate('/home')}
              title="Về trang chủ"
            >
              <Home size={16} />
            </button>
            <button type="button" className="wf-tb-lib" onClick={onOpenLibrary}>
              <FolderOpen size={15} />
              <span>Thư viện</span>
              {libraryCount > 0 && <span className="wf-tb-badge">{libraryCount}</span>}
            </button>
            <button type="button" className="wf-tb-new" onClick={onNew} title="Workflow mới">
              <Plus size={16} />
            </button>
          </div>

          <div className="wf-topbar-tabs">
            {tabs.map((t) => (
              <div
                key={t.id}
                className={`wf-tab${t.id === activeId ? ' active' : ''}`}
                onClick={() => onSelect(t.id)}
                role="button"
                tabIndex={0}
              >
                {t.pinned && <Pin size={11} className="wf-tab-pin" />}
                <span className="wf-tab-name">{t.name}</span>
                {tabs.length > 1 && (
                  <button
                    type="button"
                    className="wf-tab-close"
                    title="Đóng tab"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose(t.id);
                    }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="wf-topbar-right">
            <button type="button" className="wf-tb-pin" onClick={onSave} title="Lưu sơ đồ">
              <Save size={14} />
              <span>{saved ? 'Đã lưu' : 'Lưu'}</span>
            </button>
            <button
              type="button"
              className="wf-tb-pin wf-tb-clear"
              onClick={onClear}
              title="Xóa sơ đồ"
            >
              <Trash2 size={14} />
            </button>
            <button
              type="button"
              className={`wf-tb-pin${activeTab?.pinned ? ' active' : ''}`}
              onClick={() => activeTab && onTogglePin(activeTab.id)}
              title={activeTab?.pinned ? 'Bỏ ghim' : 'Ghim tab'}
            >
              <Pin size={14} />
              <span>Ghim</span>
            </button>
            <span className="credit-pill wf-tb-credit">{credits.toLocaleString('vi-VN')}</span>
            <UserMenuDropdown credits={credits} onCreditsRefresh={() => setCredits(getCreditsAi())} />
          </div>
        </div>
      )}

      <button
        type="button"
        className="wf-topbar-handle"
        onClick={() => setCollapsed((v) => !v)}
        title={collapsed ? 'Mở thanh công cụ' : 'Thu gọn thanh công cụ'}
      >
        <ChevronDown size={16} className={collapsed ? '' : 'up'} />
      </button>
    </div>
  );
}
```

---

## src/services/workflowTabsStore.ts

```typescript
import type { Edge, Node } from '@xyflow/react';
import { authUserKey } from './authStore';
import { loadWorkflow } from './workflowStore';

export interface WorkflowTab {
  id: string;
  name: string;
  templateId?: string | null;
  nodes: Node[];
  edges: Edge[];
  pinned: boolean;
  updatedAt: string;
}

export interface TabsState {
  tabs: WorkflowTab[];
  activeId: string;
}

const EVENT = 'wf-tabs:updated';

function userKey(): string {
  return authUserKey();
}

function tabsKey(): string {
  return `ai_wf_tabs:${userKey()}`;
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Bỏ trạng thái chạy khỏi node trước khi lưu. */
function stripRuntime(nodes: Node[]): Node[] {
  return nodes.map((n) => {
    const data = (n.data ?? {}) as Record<string, unknown>;
    const { status, statusText, resultUrl, error, ...rest } = data;
    void status;
    void statusText;
    void resultUrl;
    void error;
    return { id: n.id, type: n.type, position: n.position, data: rest } as Node;
  });
}

export function makeTab(
  name: string,
  graph: { nodes: Node[]; edges: Edge[] },
  templateId: string | null = null,
): WorkflowTab {
  return {
    id: newId('wftab'),
    name: name.trim() || 'Workflow mới',
    templateId,
    nodes: stripRuntime(graph.nodes),
    edges: graph.edges,
    pinned: false,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Tải danh sách tab. Nếu chưa có, tạo tab đầu tiên từ canvas cũ (workflowStore)
 * hoặc từ graph mặc định truyền vào.
 */
export function loadTabsState(fallbackGraph: { nodes: Node[]; edges: Edge[] }): TabsState {
  try {
    const raw = localStorage.getItem(tabsKey());
    if (raw) {
      const parsed = JSON.parse(raw) as TabsState;
      if (parsed && Array.isArray(parsed.tabs) && parsed.tabs.length) {
        const activeId = parsed.tabs.some((t) => t.id === parsed.activeId)
          ? parsed.activeId
          : parsed.tabs[0].id;
        return { tabs: parsed.tabs, activeId };
      }
    }
  } catch {
    /* ignore */
  }

  // Migrate: canvas cũ → tab đầu tiên
  const legacy = loadWorkflow();
  const graph = legacy && legacy.nodes.length ? { nodes: legacy.nodes, edges: legacy.edges } : fallbackGraph;
  const first = makeTab('Workflow 1', graph);
  const state: TabsState = { tabs: [first], activeId: first.id };
  saveTabsState(state);
  return state;
}

export function saveTabsState(state: TabsState): void {
  const clean: TabsState = {
    activeId: state.activeId,
    tabs: state.tabs.map((t) => ({ ...t, nodes: stripRuntime(t.nodes) })),
  };
  localStorage.setItem(tabsKey(), JSON.stringify(clean));
  document.dispatchEvent(new CustomEvent(EVENT));
}

export function onTabsUpdated(handler: () => void): () => void {
  document.addEventListener(EVENT, handler);
  return () => document.removeEventListener(EVENT, handler);
}
```

---

## src/services/workflowEngine.ts

```typescript
import type { GommoModel, JobType } from './api';
import { getGommoClient, loadAuth } from './authStore';
import { createJobAndPoll, type PollProgress } from './polling';
import {
  analyzeModel,
  buildJobPayload,
  defaultSelections,
  isModelAvailable,
  modelSlug,
  parseModelsList,
  type JobSelections,
} from './modelSchema';

const modelsCache = new Map<JobType, GommoModel[]>();

export async function fetchModelsForType(type: JobType): Promise<GommoModel[]> {
  const cached = modelsCache.get(type);
  if (cached) return cached;

  const auth = loadAuth();
  if (!auth?.access_token) return [];

  const env = await getGommoClient().fetchModels(type);
  const models = parseModelsList(env);
  modelsCache.set(type, models);
  return models;
}

export function pickDefaultModel(models: GommoModel[]): GommoModel | null {
  return models.find((m) => isModelAvailable(m)) ?? models[0] ?? null;
}

export interface RunNodeInput {
  type: JobType;
  modelId: string;
  selections: JobSelections;
  onStatus?: (s: string) => void;
  signal?: AbortSignal;
}

export async function runNodeJob(input: RunNodeInput): Promise<string> {
  const { type, modelId, selections, onStatus, signal } = input;

  const models = await fetchModelsForType(type);
  const model = models.find((m) => modelSlug(m) === modelId);
  if (!model) throw new Error(`Không tìm thấy model "${modelId}" cho ${type}`);

  const auth = loadAuth();
  if (!auth?.access_token) throw new Error('Chưa đăng nhập');

  const schema = analyzeModel(model, type);
  const merged: JobSelections = { ...defaultSelections(schema), ...selections };
  const { payload } = buildJobPayload(model, type, merged, {
    domain: auth.domain,
    projectId: auth.projectId,
  });

  onStatus?.('Đang tạo job…');
  const { pollResult, resultUrl } = await createJobAndPoll(
    getGommoClient(),
    type,
    modelId,
    payload,
    (p) => {
      if ('phase' in p && p.phase === 'creating') {
        onStatus?.('Đang gửi request…');
        return;
      }
      const prog = p as PollProgress;
      onStatus?.(`Poll #${prog.attempt}: ${prog.status || prog.phase}`);
    },
    signal,
  );
  if (resultUrl) return resultUrl;
  throw new Error(pollResult?.error || 'Job thất bại');
}
```

---

## src/services/workflowStore.ts

```typescript
import type { Edge, Node } from '@xyflow/react';

const KEY = 'ai_workflow_current';

export interface SavedWorkflow {
  nodes: Node[];
  edges: Edge[];
  updatedAt: string;
}

export function loadWorkflow(): SavedWorkflow | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedWorkflow;
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveWorkflow(nodes: Node[], edges: Edge[]): void {
  const data: SavedWorkflow = {
    nodes: nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: stripRuntime(n.data) })),
    edges,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function clearWorkflow(): void {
  localStorage.removeItem(KEY);
}

/** Bỏ trạng thái chạy (status/resultUrl…) khi lưu để lần mở sau không kẹt trạng thái cũ. */
function stripRuntime(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object') return {};
  const { status, statusText, resultUrl, error, ...rest } = data as Record<string, unknown>;
  void status;
  void statusText;
  void resultUrl;
  void error;
  return rest;
}
```

---

## src/components/workflow/WorkflowAgentSettingsModal.tsx

```tsx
import { useEffect, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import {
  DIRECT_DURATIONS,
  DIRECT_MODES,
  DIRECT_MODELS,
  DIRECT_RATIOS,
  DIRECT_RESOLUTIONS,
  type DirectCreateSettings,
} from '../../services/workflowAgentStore';

interface Props {
  open: boolean;
  settings: DirectCreateSettings;
  onSave: (s: DirectCreateSettings) => void;
  onClose: () => void;
}

export default function WorkflowAgentSettingsModal({ open, settings, onSave, onClose }: Props) {
  const [draft, setDraft] = useState(settings);
  const [modelOpen, setModelOpen] = useState(false);

  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

  if (!open) return null;

  const models = DIRECT_MODELS[draft.kind];
  const selectedModel = models.find((m) => m.id === draft.model) ?? models[0];

  const pill = (key: keyof DirectCreateSettings, value: string, label?: string) => (
    <button
      key={value}
      type="button"
      className={`wf-agent-set-pill${draft[key] === value ? ' active' : ''}`}
      onClick={() => setDraft((d) => ({ ...d, [key]: value }))}
    >
      {label ?? value}
    </button>
  );

  return (
    <div className="wf-agent-set-overlay" onClick={onClose}>
      <div className="wf-agent-set-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wf-agent-set-head">
          <div>
            <h3>Cài đặt tạo trực tiếp</h3>
            <p>Dùng khi Workflow Agent chạy yêu cầu tạo ảnh/video đơn mà không dựng workflow.</p>
          </div>
          <button type="button" className="wf-agent-set-x" onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </div>

        <div className="wf-agent-set-tabs">
          <button
            type="button"
            className={draft.kind === 'image' ? 'active' : ''}
            onClick={() =>
              setDraft((d) => ({
                ...d,
                kind: 'image',
                model: DIRECT_MODELS.image[0].id,
              }))
            }
          >
            Tạo ảnh
          </button>
          <button
            type="button"
            className={draft.kind === 'video' ? 'active' : ''}
            onClick={() =>
              setDraft((d) => ({
                ...d,
                kind: 'video',
                model: DIRECT_MODELS.video[0].id,
              }))
            }
          >
            Tạo video
          </button>
        </div>

        <label className="wf-agent-set-label">Model</label>
        <div className="wf-agent-set-model">
          <button
            type="button"
            className="wf-agent-set-model-trigger"
            onClick={() => setModelOpen((v) => !v)}
          >
            <span>
              <strong>{selectedModel.name}</strong>
              <small>{selectedModel.desc}</small>
            </span>
            <ChevronDown size={16} className={modelOpen ? 'up' : ''} />
          </button>
          {modelOpen && (
            <div className="wf-agent-set-model-list">
              {models.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={draft.model === m.id ? 'active' : ''}
                  onClick={() => {
                    setDraft((d) => ({ ...d, model: m.id }));
                    setModelOpen(false);
                  }}
                >
                  <strong>{m.name}</strong>
                  <small>{m.desc}</small>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="wf-agent-set-row">
          <span className="wf-agent-set-label">Tỷ lệ</span>
          <div className="wf-agent-set-pills">
            {DIRECT_RATIOS.map((r) => pill('ratio', r))}
          </div>
        </div>

        <div className="wf-agent-set-row">
          <span className="wf-agent-set-label">Phân giải</span>
          <div className="wf-agent-set-pills">
            {DIRECT_RESOLUTIONS.map((r) => pill('resolution', r))}
          </div>
        </div>

        {draft.kind === 'video' && (
          <>
            <div className="wf-agent-set-row">
              <span className="wf-agent-set-label">Thời lượng</span>
              <div className="wf-agent-set-pills">
                {DIRECT_DURATIONS.map((d) => pill('duration', d))}
              </div>
            </div>
            <div className="wf-agent-set-row">
              <span className="wf-agent-set-label">Chế độ</span>
              <div className="wf-agent-set-pills">
                {DIRECT_MODES.map((m) => pill('mode', m))}
              </div>
            </div>
          </>
        )}

        <div className="wf-agent-set-actions">
          <button type="button" className="wf-agent-set-cancel" onClick={onClose}>
            Đóng
          </button>
          <button
            type="button"
            className="wf-agent-set-save"
            onClick={() => {
              onSave(draft);
              onClose();
            }}
          >
            Lưu
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## src/components/workflow/WorkflowAgentChatSettingsModal.tsx

```tsx
import { X } from 'lucide-react';
import { AGENT_CHAT_MODELS, type AgentChatModelId } from '../../services/workflowAgentStore';

interface Props {
  open: boolean;
  modelId: AgentChatModelId;
  onSave: (modelId: AgentChatModelId) => void;
  onClose: () => void;
}

export default function WorkflowAgentChatSettingsModal({
  open,
  modelId,
  onSave,
  onClose,
}: Props) {
  if (!open) return null;

  return (
    <div className="wf-agent-set-overlay" onClick={onClose}>
      <div className="wf-agent-set-modal wf-agent-chat-set" onClick={(e) => e.stopPropagation()}>
        <div className="wf-agent-set-head">
          <div>
            <h3>Cài đặt Workflow Agent</h3>
            <p>
              Thiết lập model chat dùng chung với Chat AI. Agent gọi qua hệ thống{' '}
              <code>/api/v2/chat</code> hiện tại.
            </p>
          </div>
          <button type="button" className="wf-agent-set-x" onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </div>

        <div className="wf-agent-set-label">Model chat</div>
        <div className="wf-agent-chat-model-list">
          {AGENT_CHAT_MODELS.map((m) => (
            <button
              key={m.id}
              type="button"
              className={modelId === m.id ? 'active' : ''}
              onClick={() => {
                onSave(m.id);
                onClose();
              }}
            >
              <strong>{m.name}</strong>
              <small>{m.desc}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

