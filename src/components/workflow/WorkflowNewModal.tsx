import { useEffect, useRef, useState } from 'react';
import { Bot, Globe, Image, Sparkles } from 'lucide-react';
import {
  WORKFLOW_STARTERS,
  type WorkflowStarterId,
} from '../../services/workflowStarters';

const STARTER_ICONS: Record<WorkflowStarterId, typeof Sparkles> = {
  blank: Sparkles,
  'image-pipeline': Image,
  'agent-media': Bot,
  'api-demo': Globe,
};

interface Props {
  open: boolean;
  onCreate: (name: string, starterId: WorkflowStarterId) => void;
  onClose: () => void;
}

export default function WorkflowNewModal({ open, onCreate, onClose }: Props) {
  const [name, setName] = useState('');
  const [starterId, setStarterId] = useState<WorkflowStarterId>('blank');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setStarterId('blank');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const canCreate = name.trim().length > 0;
  const submit = () => {
    if (canCreate) onCreate(name, starterId);
  };

  return (
    <div className="wf-new-overlay" onClick={onClose}>
      <div className="wf-new-modal wf-new-modal--wide" onClick={(e) => e.stopPropagation()}>
        <h3 className="wf-new-title">Quy trình mới</h3>
        <p className="wf-new-sub">Chọn mẫu khởi tạo và đặt tên tab.</p>

        <div className="wf-new-starters">
          {WORKFLOW_STARTERS.map((starter) => {
            const Icon = STARTER_ICONS[starter.id];
            const active = starterId === starter.id;
            return (
              <button
                key={starter.id}
                type="button"
                className={`wf-new-starter${active ? ' is-active' : ''}`}
                onClick={() => setStarterId(starter.id)}
              >
                <span className="wf-new-starter-icon">
                  <Icon size={17} />
                </span>
                <span className="wf-new-starter-body">
                  <span className="wf-new-starter-name">{starter.name}</span>
                  <span className="wf-new-starter-desc">{starter.description}</span>
                </span>
              </button>
            );
          })}
        </div>

        <label className="wf-new-label" htmlFor="wf-new-name">
          Tên quy trình
        </label>
        <input
          id="wf-new-name"
          ref={inputRef}
          className="wf-new-input"
          placeholder="VD: Quảng cáo sản phẩm Tết"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') onClose();
          }}
        />
        <div className="wf-new-actions">
          <button type="button" className="wf-new-cancel" onClick={onClose}>
            Quay lại
          </button>
          <button type="button" className="wf-new-create" onClick={submit} disabled={!canCreate}>
            Tạo
          </button>
        </div>
      </div>
    </div>
  );
}
