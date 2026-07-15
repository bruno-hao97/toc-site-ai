export interface WorkflowKol {
  id: string;
  name: string;
  imageUrl: string;
  tag?: string;
}

/** Danh sách KOL mẫu — có thể mở rộng hoặc import từ API sau. */
export const WORKFLOW_KOLS: WorkflowKol[] = [
  {
    id: 'kol-demo-1',
    name: 'KOL Demo 1',
    imageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
    tag: 'Demo',
  },
  {
    id: 'kol-demo-2',
    name: 'KOL Demo 2',
    imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
    tag: 'Demo',
  },
  {
    id: 'kol-demo-3',
    name: 'KOL Demo 3',
    imageUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
    tag: 'Demo',
  },
];

export function getWorkflowKol(id: string | undefined): WorkflowKol | null {
  if (!id) return null;
  return WORKFLOW_KOLS.find((k) => k.id === id) ?? null;
}
