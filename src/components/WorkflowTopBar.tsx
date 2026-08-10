import { useEffect, useRef, useState } from 'react';
import { ChevronDown, FolderOpen, Home, Pin, Plus, Save, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDisplayCredits } from '../hooks/useDisplayCredits';
import UserMenuDropdown from './user/UserMenuDropdown';
import type { WorkflowTab } from '../services/workflowTabsStore';

interface Props {
  tabs: WorkflowTab[];
  activeId: string;
  libraryCount: number;
  dirtyTabIds: ReadonlySet<string>;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, name: string) => void;
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
  dirtyTabIds,
  onSelect,
  onClose,
  onNew,
  onRename,
  onTogglePin,
  onOpenLibrary,
  saved,
  onSave,
  onClear,
}: Props) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const renameRef = useRef<HTMLInputElement>(null);
  const { credits, platformCredits, isAdminVmedia, refresh } = useDisplayCredits();

  const activeTab = tabs.find((t) => t.id === activeId);

  useEffect(() => {
    if (editingId) renameRef.current?.focus();
  }, [editingId]);

  const startRename = (tab: WorkflowTab) => {
    setEditingId(tab.id);
    setEditName(tab.name);
  };

  const commitRename = () => {
    if (!editingId) return;
    const trimmed = editName.trim();
    if (trimmed) onRename(editingId, trimmed);
    setEditingId(null);
    setEditName('');
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditName('');
  };

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
          </div>

          <div className="wf-topbar-center">
            <div className="wf-tabstrip" role="tablist" aria-label="Workflow tabs">
              {tabs.map((t) => {
                const isEditing = editingId === t.id;
                const isDirty = dirtyTabIds.has(t.id);
                const isActive = t.id === activeId;

                return (
                  <div
                    key={t.id}
                    className={`wf-tab${isActive ? ' active' : ''}${isDirty ? ' wf-tab--dirty' : ''}`}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => !isEditing && onSelect(t.id)}
                    onKeyDown={(e) => {
                      if (isEditing) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelect(t.id);
                      }
                    }}
                    tabIndex={isEditing ? -1 : isActive ? 0 : -1}
                  >
                    {t.pinned && <Pin size={10} className="wf-tab-pin" aria-hidden />}
                    {isDirty && (
                      <span className="wf-tab-dirty" title="Chưa lưu" aria-hidden>
                        ●
                      </span>
                    )}
                    {isEditing ? (
                      <input
                        ref={renameRef}
                        className="wf-tab-rename"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            commitRename();
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            cancelRename();
                          }
                        }}
                        onBlur={commitRename}
                      />
                    ) : (
                      <span
                        className="wf-tab-name"
                        title={t.name}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          startRename(t);
                        }}
                      >
                        {t.name}
                      </span>
                    )}
                    {tabs.length > 1 && !isEditing && (
                      <button
                        type="button"
                        className="wf-tab-close"
                        title="Đóng tab"
                        aria-label={`Đóng ${t.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onClose(t.id);
                        }}
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                className="wf-tab-add"
                onClick={onNew}
                title="Workflow mới"
                aria-label="Workflow mới"
              >
                <Plus size={15} />
              </button>
            </div>
          </div>

          <div className="wf-topbar-right">
            <button
              type="button"
              className={`wf-tb-action wf-tb-save${dirtyTabIds.has(activeId) ? ' wf-tb-save--dirty' : ''}`}
              onClick={onSave}
              title="Lưu sơ đồ"
            >
              <Save size={14} />
              <span>{saved ? 'Đã lưu' : 'Lưu'}</span>
            </button>
            <button
              type="button"
              className="wf-tb-action wf-tb-clear"
              onClick={onClear}
              title="Xóa sơ đồ"
              aria-label="Xóa sơ đồ"
            >
              <Trash2 size={14} />
            </button>
            <button
              type="button"
              className={`wf-tb-action${activeTab?.pinned ? ' active' : ''}`}
              onClick={() => activeTab && onTogglePin(activeTab.id)}
              title={activeTab?.pinned ? 'Bỏ ghim' : 'Ghim tab'}
            >
              <Pin size={14} />
              <span className="wf-tb-action-label">Ghim</span>
            </button>
            {isAdminVmedia ? (
              <span className="credit-pill wf-tb-credit wf-tb-credit--dual" title="Nội bộ / Pro.agi.vn">
                {platformCredits.toLocaleString('vi-VN')}
                <span className="wf-tb-credit-sep">/</span>
                {credits.toLocaleString('vi-VN')}
              </span>
            ) : (
              <span className="credit-pill wf-tb-credit">{credits.toLocaleString('vi-VN')}</span>
            )}
            <UserMenuDropdown
              credits={credits}
              platformCredits={platformCredits}
              isAdmin={isAdminVmedia}
              onCreditsRefresh={() => void refresh()}
            />
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
