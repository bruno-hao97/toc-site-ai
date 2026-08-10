import type { Edge, Node } from '@xyflow/react';

export type WorkflowStarterId = 'blank' | 'image-pipeline' | 'agent-media' | 'api-demo';

export interface WorkflowStarterMeta {
  id: WorkflowStarterId;
  name: string;
  description: string;
}

export const WORKFLOW_STARTERS: WorkflowStarterMeta[] = [
  {
    id: 'blank',
    name: 'Trống',
    description: 'Chỉ node Bắt đầu — kéo thêm node từ sidebar.',
  },
  {
    id: 'image-pipeline',
    name: 'Tạo ảnh',
    description: 'Prompt → Tạo ảnh AI → Đầu ra → Kết thúc.',
  },
  {
    id: 'agent-media',
    name: 'Agent + Media',
    description: 'Tác nhân AI → Ảnh → Video → xuất kết quả.',
  },
  {
    id: 'api-demo',
    name: 'Gọi API',
    description: 'Văn bản → Gọi API → Kết thúc (webhook demo).',
  },
];

export function blankGraph(): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: [{ id: 'start-1', type: 'start', position: { x: 80, y: 160 }, data: {} }],
    edges: [],
  };
}

function imagePipelineGraph(): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: [
      { id: 'start-1', type: 'start', position: { x: 20, y: 140 }, data: {} },
      {
        id: 'text-1',
        type: 'text',
        position: { x: 250, y: 100 },
        data: { prompt: 'Một khung cảnh sản phẩm tối giản, ánh sáng studio' },
      },
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

function agentMediaGraph(): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: [
      { id: 'start-1', type: 'start', position: { x: 20, y: 160 }, data: {} },
      {
        id: 'text-1',
        type: 'text',
        position: { x: 220, y: 120 },
        data: { prompt: 'Viết prompt ngắn mô tả cảnh quay sản phẩm 5 giây' },
      },
      {
        id: 'agent-1',
        type: 'agent',
        position: { x: 480, y: 90 },
        data: { prompt: 'Tối ưu prompt sau thành mô tả ảnh và video ngắn.' },
      },
      { id: 'image-1', type: 'image', position: { x: 760, y: 60 }, data: {} },
      { id: 'video-1', type: 'video', position: { x: 1040, y: 100 }, data: {} },
      { id: 'output-1', type: 'output', position: { x: 1320, y: 90 }, data: {} },
      { id: 'end-1', type: 'end', position: { x: 1580, y: 150 }, data: {} },
    ],
    edges: [
      { id: 'e0', source: 'start-1', target: 'text-1', type: 'wf' },
      { id: 'e1', source: 'text-1', target: 'agent-1', type: 'wf' },
      { id: 'e2', source: 'agent-1', target: 'image-1', type: 'wf' },
      { id: 'e3', source: 'image-1', target: 'video-1', type: 'wf' },
      { id: 'e4', source: 'video-1', target: 'output-1', type: 'wf' },
      { id: 'e5', source: 'output-1', target: 'end-1', type: 'wf' },
    ],
  };
}

function apiDemoGraph(): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: [
      { id: 'start-1', type: 'start', position: { x: 40, y: 150 }, data: {} },
      {
        id: 'text-1',
        type: 'text',
        position: { x: 280, y: 110 },
        data: { prompt: '{"message":"Xin chào từ AGI Workflow"}' },
      },
      {
        id: 'api-1',
        type: 'api',
        position: { x: 560, y: 90 },
        data: {
          url: 'https://httpbin.org/post',
          method: 'POST',
        },
      },
      { id: 'end-1', type: 'end', position: { x: 860, y: 150 }, data: {} },
    ],
    edges: [
      { id: 'e0', source: 'start-1', target: 'text-1', type: 'wf' },
      { id: 'e1', source: 'text-1', target: 'api-1', type: 'wf' },
      { id: 'e2', source: 'api-1', target: 'end-1', type: 'wf' },
    ],
  };
}

export function getStarterGraph(id: WorkflowStarterId): { nodes: Node[]; edges: Edge[] } {
  switch (id) {
    case 'image-pipeline':
      return imagePipelineGraph();
    case 'agent-media':
      return agentMediaGraph();
    case 'api-demo':
      return apiDemoGraph();
    case 'blank':
    default:
      return blankGraph();
  }
}

/** Canvas trống: chưa có edge và chỉ start/note (hoặc không có node). */
export function isWorkflowCanvasEmpty(nodes: Node[], edges: Edge[]): boolean {
  if (nodes.length === 0) return true;
  if (edges.length > 0) return false;
  return nodes.every((n) => n.type === 'start' || n.type === 'note');
}
