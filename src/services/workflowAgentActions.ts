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
  'upscale-image',
  'lipsync',
  'merge',
  'extract-media',
  'agent',
  'remove-bg',
  'upscale-video',
  'vfx',
  'subtitle',
  'cut',
  'kols',
  'data-table',
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
  render: 'render',
  'render-video': 'render',
  'upscale-image': 'upscale-image',
  lipsync: 'lipsync',
  'avatar-lipsync': 'lipsync',
  merge: 'merge',
  'merge-data': 'merge',
  'extract-media': 'extract-media',
  agent: 'agent',
  'ai-agent': 'agent',
  'tac-nhan-ai': 'agent',
  'remove-bg': 'remove-bg',
  'upscale-video': 'upscale-video',
  vfx: 'vfx',
  subtitle: 'subtitle',
  cut: 'cut',
  'video-cut': 'cut',
  kols: 'kols',
  'data-table': 'data-table',
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
