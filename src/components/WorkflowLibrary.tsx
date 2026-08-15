import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { FolderOpen, Play, Save, Search, Settings2, Trash2, Upload, X } from 'lucide-react';
import {
  deleteTemplate,
  listTemplates,
  onLibraryUpdated,
  saveTemplate,
  type SavedTemplate,
  type TemplateGraph,
} from '../services/workflowLibraryStore';
import {
  assignItem,
  getItemProjectId,
  loadProjectItems,
  loadProjects,
  onProjectsUpdated,
  removeItem,
  type Project,
} from '../services/projectStore';
import { parseWflFile } from '../services/wflImport';

interface Props {
  open: boolean;
  currentGraph: () => TemplateGraph;
  onOpenTemplate: (t: SavedTemplate) => void;
  onClose: () => void;
}

function countWorkflowsByProject(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of loadProjectItems()) {
    if (item.type === 'workflow') {
      counts[item.projectId] = (counts[item.projectId] ?? 0) + 1;
    }
  }
  return counts;
}

function assignTemplateToProject(template: SavedTemplate, projectId: string | null): void {
  if (!projectId) {
    removeItem(template.id);
    return;
  }
  assignItem(
    {
      itemId: template.id,
      type: 'workflow',
      prompt: template.name,
      createdTime: template.updatedAt,
    },
    projectId,
  );
}

export default function WorkflowLibrary({ open, currentGraph, onOpenTemplate, onClose }: Props) {
  const [tick, setTick] = useState(0);
  const [query, setQuery] = useState('');
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [importError, setImportError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubLib = onLibraryUpdated(() => setTick((t) => t + 1));
    const unsubProj = onProjectsUpdated(() => setTick((t) => t + 1));
    return () => {
      unsubLib();
      unsubProj();
    };
  }, []);

  const projects = useMemo(() => loadProjects(), [tick, open]);
  const counts = useMemo(() => countWorkflowsByProject(), [tick, open]);
  const allTemplates = useMemo(() => listTemplates(null), [tick, open]);

  const templates = useMemo(() => {
    const base = activeProject
      ? allTemplates.filter((t) => getItemProjectId(t.id) === activeProject)
      : allTemplates;
    const q = query.trim().toLowerCase();
    return q ? base.filter((t) => t.name.toLowerCase().includes(q)) : base;
  }, [allTemplates, activeProject, query]);

  if (!open) return null;

  const persistToProject = (template: SavedTemplate) => {
    if (activeProject) assignTemplateToProject(template, activeProject);
  };

  const handleSaveCurrent = () => {
    const graph = currentGraph();
    if (!graph.nodes.length) {
      window.alert('Canvas đang trống — chưa có gì để lưu.');
      return;
    }
    const name = newName.trim() || `Workflow ${new Date().toLocaleString('vi-VN')}`;
    const template = saveTemplate(name, graph, null);
    persistToProject(template);
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
      const template = saveTemplate(baseName, graph, null);
      persistToProject(template);
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
            <p>Lưu, gom vào dự án và mở lại nhanh các workflow đã tạo.</p>
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
            <span className="wflib-stat-label">Dự án</span>
            <span className="wflib-stat-value">{projects.length}</span>
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
            className={`wflib-tab${activeProject === null ? ' active' : ''}`}
            onClick={() => setActiveProject(null)}
          >
            Tất cả <span className="wflib-tab-count">{allTemplates.length}</span>
          </button>
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`wflib-tab${activeProject === p.id ? ' active' : ''}`}
              onClick={() => setActiveProject(p.id)}
            >
              <span className="wflib-dot" style={{ background: p.color }} />
              {p.name} <span className="wflib-tab-count">{counts[p.id] ?? 0}</span>
            </button>
          ))}
          <Link
            to="/projects"
            className="wflib-tab wflib-manage"
            title="Quản lý dự án"
            onClick={onClose}
          >
            <Settings2 size={14} /> Quản lý dự án
          </Link>
        </div>

        <div className="wflib-grid">
          {templates.length === 0 && (
            <div className="wflib-empty">
              Chưa có workflow nào{activeProject ? ' trong dự án này' : ''}. Lưu workflow hiện tại để
              bắt đầu.
            </div>
          )}
          {templates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              projects={projects}
              onOpen={() => {
                onOpenTemplate(t);
                onClose();
              }}
            />
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function TemplateCard({
  template,
  projects,
  onOpen,
}: {
  template: SavedTemplate;
  projects: Project[];
  onOpen: () => void;
}) {
  const projectId = getItemProjectId(template.id);
  const project = projects.find((p) => p.id === projectId) || null;

  return (
    <div className="wflib-card">
      <div className="wflib-card-thumb" style={project ? { borderColor: project.color } : undefined}>
        <FolderOpen size={26} />
        {project && <span className="wflib-card-tag" style={{ background: project.color }} />}
      </div>
      <div className="wflib-card-body">
        <div className="wflib-card-name" title={template.name}>
          {template.name}
        </div>
        <div className="wflib-card-meta">{template.nodeCount} node</div>
        <div className="wflib-card-row">
          <select
            className="wflib-card-group"
            value={projectId ?? ''}
            onChange={(e) => assignTemplateToProject(template, e.target.value || null)}
          >
            <option value="">Chưa có dự án</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
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
