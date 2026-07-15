import { useState } from 'react';
import { ChevronDown, FolderOpen, Home, Pin, Plus, Save, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getCreditsAi } from '../services/authStore';
import { useCreditsUpdated } from '../hooks/useCreditsUpdated';
import UserMenuDropdown from './user/UserMenuDropdown';
import type { WorkflowTab } from '../services/workflowTabsStore';

interface Props {
  tabs: WorkflowTab[];
  activeId: string;
  libraryCount: number;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
  onTogglePin: (id: string) => void;
  onOpenLibrary: () => void;
  saved: boolean;
  onSave: () => void;
  onClear: () => void;
}

export default function WorkflowTopBar({
  tabs,
  activeId,
  libraryCount,
  onSelect,
  onClose,
  onNew,
  onTogglePin,
  onOpenLibrary,
  saved,
  onSave,
  onClear,
}: Props) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [credits, setCredits] = useState(getCreditsAi());
  useCreditsUpdated(() => setCredits(getCreditsAi()));

  const activeTab = tabs.find((t) => t.id === activeId);

  return (
    <div className={`wf-topbar${collapsed ? ' collapsed' : ''}`}>
      {!collapsed && (
        <div className="wf-topbar-inner">
          <div className="wf-topbar-left">
            <button
              type="button"
              className="wf-tb-home"
              onClick={() => navigate('/home')}
              title="Về trang chủ"
            >
              <Home size={16} />
            </button>
            <button type="button" className="wf-tb-lib" onClick={onOpenLibrary}>
              <FolderOpen size={15} />
              <span>Thư viện</span>
              {libraryCount > 0 && <span className="wf-tb-badge">{libraryCount}</span>}
            </button>
            <button type="button" className="wf-tb-new" onClick={onNew} title="Workflow mới">
              <Plus size={16} />
            </button>
          </div>

          <div className="wf-topbar-tabs">
            {tabs.map((t) => (
              <div
                key={t.id}
                className={`wf-tab${t.id === activeId ? ' active' : ''}`}
                onClick={() => onSelect(t.id)}
                role="button"
                tabIndex={0}
              >
                {t.pinned && <Pin size={11} className="wf-tab-pin" />}
                <span className="wf-tab-name">{t.name}</span>
                {tabs.length > 1 && (
                  <button
                    type="button"
                    className="wf-tab-close"
                    title="Đóng tab"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose(t.id);
                    }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="wf-topbar-right">
            <button type="button" className="wf-tb-pin" onClick={onSave} title="Lưu sơ đồ">
              <Save size={14} />
              <span>{saved ? 'Đã lưu' : 'Lưu'}</span>
            </button>
            <button
              type="button"
              className="wf-tb-pin wf-tb-clear"
              onClick={onClear}
              title="Xóa sơ đồ"
            >
              <Trash2 size={14} />
            </button>
            <button
              type="button"
              className={`wf-tb-pin${activeTab?.pinned ? ' active' : ''}`}
              onClick={() => activeTab && onTogglePin(activeTab.id)}
              title={activeTab?.pinned ? 'Bỏ ghim' : 'Ghim tab'}
            >
              <Pin size={14} />
              <span>Ghim</span>
            </button>
            <span className="credit-pill wf-tb-credit">{credits.toLocaleString('vi-VN')}</span>
            <UserMenuDropdown credits={credits} onCreditsRefresh={() => setCredits(getCreditsAi())} />
          </div>
        </div>
      )}

      <button
        type="button"
        className="wf-topbar-handle"
        onClick={() => setCollapsed((v) => !v)}
        title={collapsed ? 'Mở thanh công cụ' : 'Thu gọn thanh công cụ'}
      >
        <ChevronDown size={16} className={collapsed ? '' : 'up'} />
      </button>
    </div>
  );
}
