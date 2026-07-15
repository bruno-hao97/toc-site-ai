import type { WfPortDef } from './workflowAiGenPorts';

export const TEXT_PORTS = {
  in: [
    { id: 'trigger', label: 'Kích hoạt', color: '#22d3ee' },
    { id: 'text-in', label: 'Văn bản', color: '#60a5fa' },
  ],
  out: [
    { id: 'done', label: 'Xong', color: '#e5e7eb' },
    { id: 'text-out', label: 'Văn bản', color: '#60a5fa' },
  ],
} as const satisfies { in: WfPortDef[]; out: WfPortDef[] };

export const OUTPUT_PORTS = {
  in: [
    { id: 'trigger', label: 'Kích hoạt', color: '#22d3ee' },
    { id: 'data', label: 'Dữ liệu', color: '#94a3b8' },
    { id: 'image', label: 'Ảnh', color: '#c084fc' },
    { id: 'video', label: 'Video', color: '#60a5fa' },
    { id: 'audio', label: 'Âm thanh', color: '#34d399' },
    { id: 'text', label: 'Văn bản', color: '#60a5fa' },
    { id: 'note', label: 'Ghi chú', color: '#fbbf24' },
  ],
  out: [
    { id: 'done', label: 'Xong', color: '#e5e7eb' },
    { id: 'out', label: 'Đầu ra', color: '#34d399' },
  ],
} as const satisfies { in: WfPortDef[]; out: WfPortDef[] };

export const RENDER_PORTS = {
  in: [
    { id: 'trigger', label: 'Kích hoạt', color: '#22d3ee' },
    { id: 'video', label: 'Video', color: '#60a5fa' },
  ],
  out: [
    { id: 'done', label: 'Xong', color: '#e5e7eb' },
    { id: 'video', label: 'Video', color: '#60a5fa' },
  ],
} as const satisfies { in: WfPortDef[]; out: WfPortDef[] };

export const UPSCALE_IMAGE_PORTS = {
  in: [
    { id: 'trigger', label: 'Kích hoạt', color: '#22d3ee' },
    { id: 'image', label: 'Ảnh', color: '#c084fc' },
  ],
  out: [
    { id: 'done', label: 'Xong', color: '#e5e7eb' },
    { id: 'media-out', label: 'URL Ảnh', color: '#c084fc' },
  ],
} as const satisfies { in: WfPortDef[]; out: WfPortDef[] };

export const LIPSYNC_PORTS = {
  in: [
    { id: 'trigger', label: 'Kích hoạt', color: '#22d3ee' },
    { id: 'image', label: 'Ảnh', color: '#c084fc' },
    { id: 'audio', label: 'Âm thanh', color: '#34d399' },
    { id: 'text', label: 'Văn bản', color: '#60a5fa' },
  ],
  out: [
    { id: 'done', label: 'Xong', color: '#e5e7eb' },
    { id: 'media-out', label: 'URL Video', color: '#60a5fa' },
  ],
} as const satisfies { in: WfPortDef[]; out: WfPortDef[] };

export const MERGE_PORTS = {
  in: [
    { id: 'trigger', label: 'Kích hoạt', color: '#22d3ee' },
    { id: 'data', label: 'Dữ liệu', color: '#94a3b8' },
    { id: 'image', label: 'Ảnh', color: '#c084fc' },
    { id: 'video', label: 'Video', color: '#60a5fa' },
    { id: 'audio', label: 'Âm thanh', color: '#34d399' },
    { id: 'text', label: 'Văn bản', color: '#60a5fa' },
  ],
  out: [
    { id: 'done', label: 'Xong', color: '#e5e7eb' },
    { id: 'out', label: 'Đầu ra', color: '#34d399' },
    { id: 'all', label: 'Tất cả', color: '#94a3b8' },
  ],
} as const satisfies { in: WfPortDef[]; out: WfPortDef[] };

export const EXTRACT_MEDIA_PORTS = {
  in: [
    { id: 'trigger', label: 'Kích hoạt', color: '#22d3ee' },
    { id: 'media-in', label: 'Media vào', color: '#60a5fa' },
  ],
  out: [
    { id: 'done', label: 'Xong', color: '#e5e7eb' },
    { id: 'media-out', label: 'Media', color: '#60a5fa' },
    { id: 'first-frame', label: 'Frame đầu', color: '#c084fc' },
    { id: 'image', label: 'Ảnh', color: '#c084fc' },
    { id: 'video', label: 'Video', color: '#60a5fa' },
    { id: 'audio', label: 'Âm thanh', color: '#34d399' },
  ],
} as const satisfies { in: WfPortDef[]; out: WfPortDef[] };

export const AGENT_PORTS = {
  in: [
    { id: 'trigger', label: 'Kích hoạt', color: '#22d3ee' },
    { id: 'text-in', label: 'Văn bản', color: '#60a5fa' },
  ],
  out: [
    { id: 'done', label: 'Xong', color: '#e5e7eb' },
    { id: 'text-out', label: 'Văn bản', color: '#60a5fa' },
  ],
} as const satisfies { in: WfPortDef[]; out: WfPortDef[] };

const MEDIA_PROCESS_IN = [
  { id: 'trigger', label: 'Kích hoạt', color: '#22d3ee' },
  { id: 'image', label: 'Ảnh', color: '#c084fc' },
  { id: 'video', label: 'Video', color: '#60a5fa' },
  { id: 'text', label: 'Văn bản', color: '#60a5fa' },
] as const satisfies WfPortDef[];

const MEDIA_PROCESS_OUT = [
  { id: 'done', label: 'Xong', color: '#e5e7eb' },
  { id: 'media-out', label: 'URL', color: '#34d399' },
] as const satisfies WfPortDef[];

export const REMOVE_BG_PORTS = {
  in: [
    { id: 'trigger', label: 'Kích hoạt', color: '#22d3ee' },
    { id: 'image', label: 'Ảnh', color: '#c084fc' },
  ],
  out: MEDIA_PROCESS_OUT,
} as const satisfies { in: WfPortDef[]; out: WfPortDef[] };

export const UPSCALE_VIDEO_PORTS = {
  in: [
    { id: 'trigger', label: 'Kích hoạt', color: '#22d3ee' },
    { id: 'video', label: 'Video', color: '#60a5fa' },
  ],
  out: [
    { id: 'done', label: 'Xong', color: '#e5e7eb' },
    { id: 'media-out', label: 'URL Video', color: '#60a5fa' },
  ],
} as const satisfies { in: WfPortDef[]; out: WfPortDef[] };

export const VFX_PORTS = {
  in: MEDIA_PROCESS_IN,
  out: [
    { id: 'done', label: 'Xong', color: '#e5e7eb' },
    { id: 'media-out', label: 'URL Video', color: '#60a5fa' },
  ],
} as const satisfies { in: WfPortDef[]; out: WfPortDef[] };

export const SUBTITLE_PORTS = {
  in: [
    { id: 'trigger', label: 'Kích hoạt', color: '#22d3ee' },
    { id: 'video', label: 'Video', color: '#60a5fa' },
    { id: 'text', label: 'Phụ đề', color: '#60a5fa' },
    { id: 'audio', label: 'Âm thanh', color: '#34d399' },
  ],
  out: [
    { id: 'done', label: 'Xong', color: '#e5e7eb' },
    { id: 'media-out', label: 'URL Video', color: '#60a5fa' },
  ],
} as const satisfies { in: WfPortDef[]; out: WfPortDef[] };

export const CUT_VIDEO_PORTS = {
  in: [
    { id: 'trigger', label: 'Kích hoạt', color: '#22d3ee' },
    { id: 'video', label: 'Video', color: '#60a5fa' },
  ],
  out: [
    { id: 'done', label: 'Xong', color: '#e5e7eb' },
    { id: 'media-out', label: 'URL Video', color: '#60a5fa' },
  ],
} as const satisfies { in: WfPortDef[]; out: WfPortDef[] };

export const KOLS_PORTS = {
  in: [{ id: 'trigger', label: 'Kích hoạt', color: '#22d3ee' }],
  out: [
    { id: 'done', label: 'Xong', color: '#e5e7eb' },
    { id: 'image', label: 'Ảnh KOL', color: '#c084fc' },
    { id: 'text-out', label: 'Tên KOL', color: '#60a5fa' },
  ],
} as const satisfies { in: WfPortDef[]; out: WfPortDef[] };

export const DATA_TABLE_PORTS = {
  in: [
    { id: 'trigger', label: 'Kích hoạt', color: '#22d3ee' },
    { id: 'data', label: 'Dữ liệu', color: '#94a3b8' },
    { id: 'text', label: 'Văn bản', color: '#60a5fa' },
  ],
  out: [
    { id: 'done', label: 'Xong', color: '#e5e7eb' },
    { id: 'text-out', label: 'JSON', color: '#60a5fa' },
    { id: 'out', label: 'Hàng đầu', color: '#34d399' },
  ],
} as const satisfies { in: WfPortDef[]; out: WfPortDef[] };
