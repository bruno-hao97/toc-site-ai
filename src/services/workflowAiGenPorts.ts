export interface WfPortDef {
  id: string;
  label: string;
  color?: string;
}

export const AI_GEN_PORTS = {
  image: {
    in: [
      { id: 'trigger', label: 'Kích hoạt', color: '#53eb67' },
      { id: 'prompt', label: 'Prompt', color: '#53eb67' },
      { id: 'ref', label: 'Ảnh tham chiếu', color: '#c084fc' },
    ],
    out: [
      { id: 'done', label: 'Xong', color: '#e5e7eb' },
      { id: 'media-out', label: 'URL Ảnh', color: '#c084fc' },
      { id: 'all', label: 'Tất cả ảnh', color: '#c084fc' },
      { id: 'prompt', label: 'Prompt', color: '#53eb67' },
    ],
  },
  video: {
    in: [
      { id: 'trigger', label: 'Kích hoạt', color: '#53eb67' },
      { id: 'prompt', label: 'Prompt', color: '#53eb67' },
      { id: 'ref', label: 'Ảnh tham chiếu', color: '#c084fc' },
    ],
    out: [
      { id: 'done', label: 'Xong', color: '#e5e7eb' },
      { id: 'media-out', label: 'URL Video', color: '#c084fc' },
      { id: 'all', label: 'Tất cả video', color: '#c084fc' },
      { id: 'prompt', label: 'Prompt', color: '#53eb67' },
    ],
  },
} as const satisfies Record<string, { in: WfPortDef[]; out: WfPortDef[] }>;

export type AiGenPortKind = keyof typeof AI_GEN_PORTS;
