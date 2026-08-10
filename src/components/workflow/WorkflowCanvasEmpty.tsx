import { Bot, FolderOpen, Globe, Image, Sparkles } from 'lucide-react';
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
  onApplyStarter: (id: WorkflowStarterId) => void;
  onOpenLibrary: () => void;
}

export default function WorkflowCanvasEmpty({ onApplyStarter, onOpenLibrary }: Props) {
  const quickStarters = WORKFLOW_STARTERS.filter((s) => s.id !== 'blank');

  return (
    <div className="wf-empty" aria-live="polite">
      <div className="wf-empty-card">
        <p className="wf-empty-kicker">Canvas trống</p>
        <h2 className="wf-empty-title">Bắt đầu quy trình</h2>
        <p className="wf-empty-hint">
          Kéo node từ sidebar trái vào đây, hoặc chọn mẫu nhanh bên dưới.
        </p>

        <div className="wf-empty-starters">
          {quickStarters.map((starter) => {
            const Icon = STARTER_ICONS[starter.id];
            return (
              <button
                key={starter.id}
                type="button"
                className="wf-empty-starter"
                onClick={() => onApplyStarter(starter.id)}
              >
                <span className="wf-empty-starter-icon">
                  <Icon size={18} />
                </span>
                <span className="wf-empty-starter-body">
                  <span className="wf-empty-starter-name">{starter.name}</span>
                  <span className="wf-empty-starter-desc">{starter.description}</span>
                </span>
              </button>
            );
          })}
        </div>

        <button type="button" className="wf-empty-lib" onClick={onOpenLibrary}>
          <FolderOpen size={15} />
          Mở thư viện workflow
        </button>
      </div>
    </div>
  );
}
