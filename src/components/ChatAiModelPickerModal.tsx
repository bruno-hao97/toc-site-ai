import { useMemo, useState } from 'react';
import { Plus, Search, Sparkles, X } from 'lucide-react';
import {
  CHAT_AI_MODELS,
  filterChatAiModels,
  groupChatAiModelsByProvider,
  listChatAiProviderNav,
  type ChatAiModel,
} from '../services/chatAiModels';

type TabId = 'suggested' | 'community' | 'mine';

interface Props {
  open: boolean;
  selectedId: string;
  onSelect: (modelId: string) => void;
  onClose: () => void;
}

function ModelMeta({ model }: { model: ChatAiModel }) {
  if (model.salePercent != null) {
    return (
      <span className="chat-ai-model-sale">
        <Sparkles size={11} />
        -{model.salePercent}%
      </span>
    );
  }
  if (model.tags?.length) {
    return (
      <span className="chat-ai-model-tags">
        {model.tags.map((t) => (
          <span key={t} className={`chat-ai-model-tag chat-ai-model-tag--${t.toLowerCase()}`}>
            {t}
          </span>
        ))}
      </span>
    );
  }
  return null;
}

export default function ChatAiModelPickerModal({ open, selectedId, onSelect, onClose }: Props) {
  const [tab, setTab] = useState<TabId>('suggested');
  const [providerId, setProviderId] = useState('all');
  const [query, setQuery] = useState('');

  const nav = useMemo(() => listChatAiProviderNav(), []);
  const filtered = useMemo(
    () => filterChatAiModels(CHAT_AI_MODELS, { providerId, query }),
    [providerId, query],
  );
  const grouped = useMemo(() => groupChatAiModelsByProvider(filtered), [filtered]);

  if (!open) return null;

  return (
    <div className="chat-ai-model-overlay" onClick={onClose}>
      <div
        className="chat-ai-model-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Chọn model Chat AI"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="chat-ai-model-head">
          <h3>Chọn model Chat AI</h3>
          <button type="button" className="chat-ai-model-x" onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </header>

        <div className="chat-ai-model-tabs" role="tablist">
          {(
            [
              ['suggested', 'Đề xuất'],
              ['community', 'Cộng đồng'],
              ['mine', 'Của tôi'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={tab === id ? 'active' : ''}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'suggested' && (
          <div className="chat-ai-model-body">
            <div className="chat-ai-model-search">
              <Search size={15} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm model…"
                autoFocus
              />
            </div>
            <div className="chat-ai-model-layout">
              <aside className="chat-ai-model-nav">
                {nav.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={providerId === item.id ? 'active' : ''}
                    onClick={() => setProviderId(item.id)}
                  >
                    <span>{item.label}</span>
                    <span className="chat-ai-model-nav-count">{item.count}</span>
                  </button>
                ))}
              </aside>
              <div className="chat-ai-model-list">
                {grouped.length === 0 ? (
                  <div className="chat-ai-model-empty">Không tìm thấy model phù hợp.</div>
                ) : (
                  grouped.map(([provider, models]) => (
                    <section key={provider} className="chat-ai-model-group">
                      <h4>{provider}</h4>
                      <div className="chat-ai-model-rows">
                        {models.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            className={`chat-ai-model-row${selectedId === m.id ? ' active' : ''}`}
                            disabled={!m.selectable}
                            onClick={() => {
                              if (!m.selectable) return;
                              onSelect(m.id);
                              onClose();
                            }}
                          >
                            <span className="chat-ai-model-row-name">{m.name}</span>
                            <ModelMeta model={m} />
                          </button>
                        ))}
                      </div>
                    </section>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'community' && (
          <div className="chat-ai-model-body chat-ai-model-body--plain">
            <div className="chat-ai-model-search">
              <Search size={15} />
              <input placeholder="Tìm model hoặc nguồn…" disabled />
            </div>
            <p className="chat-ai-model-hint">
              Model do cộng đồng chia sẻ công khai. Nhấp để xem - Nhấp đúp để chọn.
            </p>
            <div className="chat-ai-model-empty chat-ai-model-empty--fill">
              Chưa có model công khai nào.
            </div>
          </div>
        )}

        {tab === 'mine' && (
          <div className="chat-ai-model-body chat-ai-model-body--plain">
            <section className="chat-ai-model-income">
              <h4>Thu nhập model</h4>
              <p className="chat-ai-model-hint">
                Người dùng trả đủ (gồm phí sàn). Bạn chỉ nhận phần còn lại sau khi trừ phí nền tảng
                (~30%). Rút về ví cần được duyệt.
              </p>
              <div className="chat-ai-model-stats">
                {[
                  ['Số dư', '0'],
                  ['Đang chờ rút', '0'],
                  ['Người dùng đã trả', '0'],
                  ['Phí sàn đã trừ', '0'],
                ].map(([label, value]) => (
                  <div key={label} className="chat-ai-model-stat">
                    <span>{label}</span>
                    <strong className={label === 'Phí sàn đã trừ' ? 'accent' : ''}>{value}</strong>
                  </div>
                ))}
              </div>
              <div className="chat-ai-model-withdraw">
                <input type="text" placeholder="Số credit muốn rút" disabled />
                <button type="button" disabled>
                  Rút credit
                </button>
              </div>
            </section>

            <div className="chat-ai-model-mine-actions">
              <p className="chat-ai-model-hint">
                Thêm nguồn model riêng của bạn. Giá nhập bằng USD, hệ thống quy đổi ra credit. Mặc định
                chỉ bạn thấy; có thể mở công khai khi sẵn sàng.
              </p>
              <div className="chat-ai-model-mine-btns">
                <button type="button" className="primary" disabled>
                  <Plus size={14} /> Nguồn
                </button>
                <button type="button" disabled>
                  <Plus size={14} /> Model
                </button>
              </div>
            </div>

            <div className="chat-ai-model-empty chat-ai-model-empty--fill">
              <strong>Chưa có nguồn nào</strong>
              <span>Bấm + Nguồn để kết nối model riêng và bắt đầu chia sẻ.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
