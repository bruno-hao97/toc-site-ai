export interface WfPortDef {
  id: string;
  label: string;
  color?: string;
}

export const AI_GEN_PORTS = {
  image: {
    in: [
      { id: 'trigger', label: 'Kích hoạt', color: '#22d3ee' },
      { id: 'prompt', label: 'Prompt', color: '#60a5fa' },
      { id: 'ref', label: 'Ảnh tham chiếu', color: '#c084fc' },
    ],
    out: [
      { id: 'done', label: 'Xong', color: '#e5e7eb' },
      { id: 'media-out', label: 'URL Ảnh', color: '#c084fc' },
      { id: 'all', label: 'Tất cả ảnh', color: '#c084fc' },
      { id: 'prompt', label: 'Prompt', color: '#60a5fa' },
    ],
  },
  video: {
    in: [
      { id: 'trigger', label: 'Kích hoạt', color: '#22d3ee' },
      { id: 'prompt', label: 'Prompt', color: '#60a5fa' },
      { id: 'ref', label: 'Ảnh tham chiếu', color: '#c084fc' },
    ],
    out: [
      { id: 'done', label: 'Xong', color: '#e5e7eb' },
      { id: 'media-out', label: 'URL Video', color: '#c084fc' },
      { id: 'all', label: 'Tất cả video', color: '#c084fc' },
      { id: 'prompt', label: 'Prompt', color: '#60a5fa' },
    ],
  },
} as const satisfies Record<string, { in: WfPortDef[]; out: WfPortDef[] }>;

export type AiGenPortKind = keyof typeof AI_GEN_PORTS;
