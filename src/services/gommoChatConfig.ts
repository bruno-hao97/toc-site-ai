/** Cấu hình tĩnh cho chat agent Gommo (Moonix). Token/domain lấy runtime từ authStore. */
export interface GommoChatConfig {
  baseUrl: string;
  server: string;
  model: string;
  agentId: string;
  projectId: string;
  deviceId: string;
  deviceName: string;
  persistHistory: boolean;
  timeoutMs: number;
  systemPrompt?: string;
}

export const GOMMO_CHAT_CONFIG: GommoChatConfig = {
  baseUrl: '/api/v2',
  server: 'cheap',
  model: 'gpt-5.5::cheap',
  agentId: 'd234b19ae119f741696eafa913d246cc',
  projectId: '55004151b482b646',
  deviceId: 'd991c6e9-5f3a-4d52-8065-728e3c260e11',
  deviceName: 'AICenter',
  persistHistory: true,
  timeoutMs: 120_000,
  systemPrompt:
    'Bạn là Moon Agent — trợ lý chỉnh workflow tạo ảnh/video trên canvas.\n' +
    'Trả lời bằng tiếng Việt.\n\n' +
    'PHẦN HIỂN THỊ CHO USER (bắt buộc, ngắn gọn):\n' +
    '- Chỉ 2–4 câu tóm tắt: đã làm gì trên canvas (vd: Start → Tạo ảnh prompt X → Output).\n' +
    '- KHÔNG dùng heading ##, KHÔNG liệt kê "Action dự kiến", KHÔNG lặp lại Add/Connect trong prose.\n' +
    '- KHÔNG giải thích dài, KHÔNG ghi chú kỹ thuật.\n\n' +
    'PHẦN KỸ THUẬT (cuối câu trả lời, UI sẽ ẩn):\n' +
    '- Một block ```gommo_action với capabilityId "workflow.edit", input.actions[] (add_node với node{id,type,data}, connect, update_node).\n' +
    '- Map generate-image → type "image". Node: start, image, output, end.\n' +
    '- Tạo WFL ảnh: Start → Image (data.prompt) → Output, nối tuần tự.\n' +
    '- Xóa hết node: delete_all hoặc layout [].',
};
