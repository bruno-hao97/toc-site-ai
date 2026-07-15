import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, FolderOpen, Play, Plus, Save, Search, Settings2, Trash2, Upload, X } from 'lucide-react';
import {
  assignTemplateToGroup,
  countByGroup,
  createGroup,
  deleteGroup,
  deleteTemplate,
  listTemplates,
  loadGroups,
  onLibraryUpdated,
  saveTemplate,
  updateGroup,
  WORKFLOW_GROUP_COLORS,
  type SavedTemplate,
  type TemplateGraph,
  type WorkflowGroup,
} from '../services/workflowLibraryStore';
import { parseWflFile } from '../services/wflImport';

interface Props {
  open: boolean;
  currentGraph: () => TemplateGraph;
  onOpenTemplate: (t: SavedTemplate) => void;
  onClose: () => void;
}

export default function WorkflowLibrary({ open, currentGraph, onOpenTemplate, onClose }: Props) {
  const [tick, setTick] = useState(0);
  const [query, setQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [importError, setImportError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => onLibraryUpdated(() => setTick((t) => t + 1)), []);

  const groups = useMemo(() => loadGroups(), [tick, open]);
  const counts = useMemo(() => countByGroup(), [tick, open]);
  const allTemplates = useMemo(() => listTemplates(null), [tick, open]);

  const templates = useMemo(() => {
    const base = activeGroup ? allTemplates.filter((t) => t.groupId === activeGroup) : allTemplates;
    const q = query.trim().toLowerCase();
    return q ? base.filter((t) => t.name.toLowerCase().includes(q)) : base;
  }, [allTemplates, activeGroup, query]);

  if (!open) return null;

  const handleSaveCurrent = () => {
    const graph = currentGraph();
    if (!graph.nodes.length) {
      window.alert('Canvas đang trống — chưa có gì để lưu.');
      return;
    }
    const name = newName.trim() || `Workflow ${new Date().toLocaleString('vi-VN')}`;
    saveTemplate(name, graph, activeGroup);
    setNewName('');
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    setImportError('');
    try {
      const raw = await file.text();
      const { name, graph } = parseWflFile(raw);
      if (!graph.nodes.length) {
        setImportError('File không có node nào.');
        return;
      }
      const baseName = name || file.name.replace(/\.(wfl|json)$/i, '');
      saveTemplate(baseName, graph, activeGroup);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return createPortal(
    <div className="wflib-overlay" onClick={onClose}>
      <div className="wflib-modal" onClick={(e) => e.stopPropagation()}>
        <header className="wflib-head">
          <div className="wflib-head-icon">
            <FolderOpen size={20} />
          </div>
          <div className="wflib-head-text">
            <span className="wflib-eyebrow">AUTO WORKFLOW</span>
            <h2>Thư viện Workflow</h2>
            <p>Lưu, gom nhóm và mở lại nhanh các workflow đã tạo.</p>
          </div>
          <button type="button" className="wflib-close" onClick={onClose} title="Đóng">
            <X size={18} />
          </button>
        </header>

        <div className="wflib-stats">
          <div className="wflib-stat">
            <span className="wflib-stat-label">Workflow</span>
            <span className="wflib-stat-value">{allTemplates.length}</span>
          </div>
          <div className="wflib-stat">
            <span className="wflib-stat-label">Nhóm</span>
            <span className="wflib-stat-value">{groups.length}</span>
          </div>
        </div>

        <div className="wflib-actions">
          <div className="wflib-search">
            <Search size={15} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm workflow…"
            />
          </div>
          <input
            type="text"
            className="wflib-name-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Tên workflow hiện tại…"
          />
          <button type="button" className="wflib-save-btn" onClick={handleSaveCurrent}>
            <Save size={15} /> Lưu workflow hiện tại
          </button>
          <button
            type="button"
            className="wflib-import-btn"
            onClick={() => fileRef.current?.click()}
            title="Import file .wfl / .json"
          >
            <Upload size={15} /> Import file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".wfl,.json,application/json"
            className="sr-only"
            onChange={(e) => void handleImportFile(e.target.files?.[0])}
          />
        </div>

        {importError && <div className="wflib-import-error">{importError}</div>}

        <div className="wflib-tabs">
          <button
            type="button"
            className={`wflib-tab${activeGroup === null ? ' active' : ''}`}
            onClick={() => setActiveGroup(null)}
          >
            Tất cả <span className="wflib-tab-count">{allTemplates.length}</span>
          </button>
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              className={`wflib-tab${activeGroup === g.id ? ' active' : ''}`}
              onClick={() => setActiveGroup(g.id)}
            >
              <span className="wflib-dot" style={{ background: g.color }} />
              {g.name} <span className="wflib-tab-count">{counts[g.id] ?? 0}</span>
            </button>
          ))}
          <button
            type="button"
            className="wflib-tab wflib-manage"
            onClick={() => setManageOpen(true)}
            title="Quản lý nhóm"
          >
            <Settings2 size={14} /> Quản lý nhóm
          </button>
        </div>

        <div className="wflib-grid">
          {templates.length === 0 && (
            <div className="wflib-empty">
              Chưa có workflow nào{activeGroup ? ' trong nhóm này' : ''}. Lưu workflow hiện tại để
              bắt đầu.
            </div>
          )}
          {templates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              groups={groups}
              onOpen={() => {
                onOpenTemplate(t);
                onClose();
              }}
            />
          ))}
        </div>

        {manageOpen && <ManageGroups groups={groups} onClose={() => setManageOpen(false)} />}
      </div>
    </div>,
    document.body,
  );
}

function TemplateCard({
  template,
  groups,
  onOpen,
}: {
  template: SavedTemplate;
  groups: WorkflowGroup[];
  onOpen: () => void;
}) {
  const group = groups.find((g) => g.id === template.groupId) || null;
  return (
    <div className="wflib-card">
      <div className="wflib-card-thumb" style={group ? { borderColor: group.color } : undefined}>
        <FolderOpen size={26} />
        {group && <span className="wflib-card-tag" style={{ background: group.color }} />}
      </div>
      <div className="wflib-card-body">
        <div className="wflib-card-name" title={template.name}>
          {template.name}
        </div>
        <div className="wflib-card-meta">{template.nodeCount} node</div>
        <div className="wflib-card-row">
          <select
            className="wflib-card-group"
            value={template.groupId ?? ''}
            onChange={(e) => assignTemplateToGroup(template.id, e.target.value || null)}
          >
            <option value="">Chưa phân nhóm</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="wflib-card-actions">
        <button type="button" className="wflib-card-open" onClick={onOpen}>
          <Play size={13} /> Mở
        </button>
        <button
          type="button"
          className="wflib-card-del"
          title="Xóa"
          onClick={() => {
            if (window.confirm(`Xóa workflow "${template.name}"?`)) deleteTemplate(template.id);
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function ManageGroups({ groups, onClose }: { groups: WorkflowGroup[]; onClose: () => void }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(WORKFLOW_GROUP_COLORS[0]);

  const create = () => {
    if (!name.trim()) return;
    createGroup(name, color);
    setName('');
  };

  return (
    <div className="wflib-sub-overlay" onClick={onClose}>
      <div className="wflib-sub" onClick={(e) => e.stopPropagation()}>
        <header className="wflib-sub-head">
          <div className="wflib-head-icon sm">
            <FolderOpen size={16} />
          </div>
          <div className="wflib-head-text">
            <h3>Quản lý nhóm Workflow</h3>
            <p>Tạo và quản lý nhóm để phân loại workflow.</p>
          </div>
          <button type="button" className="wflib-close" onClick={onClose} title="Đóng">
            <X size={16} />
          </button>
        </header>

        <div className="wflib-sub-create">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            placeholder="Tên nhóm mới…"
          />
          <div className="wflib-swatches">
            {WORKFLOW_GROUP_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`wflib-swatch${color === c ? ' active' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
              >
                {color === c && <Check size={12} />}
              </button>
            ))}
          </div>
          <button type="button" className="wflib-sub-add" onClick={create} disabled={!name.trim()}>
            <Plus size={15} />
          </button>
        </div>

        <div className="wflib-sub-list">
          {groups.length === 0 && <div className="wflib-empty sm">Chưa có nhóm nào.</div>}
          {groups.map((g) => (
            <GroupRow key={g.id} group={g} />
          ))}
        </div>
      </div>
    </div>
  );
}

function GroupRow({ group }: { group: WorkflowGroup }) {
  const counts = countByGroup();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);

  const commit = () => {
    updateGroup(group.id, { name });
    setEditing(false);
  };

  return (
    <div className="wflib-grp-row">
      <span className="wflib-dot" style={{ background: group.color }} />
      {editing ? (
        <input
          className="wflib-grp-edit"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
        />
      ) : (
        <button type="button" className="wflib-grp-name" onClick={() => setEditing(true)}>
          {group.name}
          <span className="wflib-grp-count">{counts[group.id] ?? 0} workflow</span>
        </button>
      )}
      <button
        type="button"
        className="wflib-card-del"
        title="Xóa nhóm"
        onClick={() => {
          if (window.confirm(`Xóa nhóm "${group.name}"? Workflow sẽ về "chưa phân nhóm".`))
            deleteGroup(group.id);
        }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
