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
