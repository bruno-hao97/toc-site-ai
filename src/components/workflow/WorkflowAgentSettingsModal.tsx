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
