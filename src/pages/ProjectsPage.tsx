import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, FolderOpen, Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  countByProject,
  createProject,
  deleteProject,
  listItemsByProject,
  loadProjectItems,
  loadProjects,
  onProjectsUpdated,
  removeItem,
  updateProject,
  PROJECT_COLORS,
  type Project,
  type ProjectItem,
} from '../services/projectStore';

type CatFilter = 'all' | 'image' | 'video' | 'tts' | 'music';

const CATS: { value: CatFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'image', label: 'Ảnh' },
  { value: 'video', label: 'Video' },
  { value: 'tts', label: 'Audio' },
  { value: 'music', label: 'Nhạc' },
];

function renderMedia(it: ProjectItem) {
  const url = it.downloadUrl || it.thumbnailUrl || '';
  if (it.type === 'image' || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url)) {
    return <img src={it.thumbnailUrl || url} alt="" loading="lazy" />;
  }
  if (it.type === 'video' || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)) {
    if (it.thumbnailUrl) return <img src={it.thumbnailUrl} alt="" loading="lazy" />;
    return <video src={url} preload="metadata" muted playsInline />;
  }
  return <span className="project-item-icon">{it.type === 'music' ? '🎵' : '🔊'}</span>;
}

export default function ProjectsPage() {
  const [searchParams] = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<string | null>(searchParams.get('p')); // null = "Tất cả"
  const [cat, setCat] = useState<CatFilter>('all');
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const refresh = () => {
    setProjects(loadProjects());
    setCounts(countByProject());
    setTotal(loadProjectItems().length);
  };

  useEffect(() => {
    refresh();
    return onProjectsUpdated(refresh);
  }, []);

  const items = useMemo(() => {
    const base = listItemsByProject(selected);
    if (cat === 'all') return base;
    return base.filter((it) => it.type === cat);
  }, [selected, cat, projects, counts]);

  const selectedProject = projects.find((p) => p.id === selected) || null;

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    const p = createProject(name);
    setNewName('');
    setSelected(p.id);
  };

  const startEdit = (p: Project) => {
    setEditing(p.id);
    setEditName(p.name);
  };

  const saveEdit = (id: string) => {
    updateProject(id, { name: editName });
    setEditing(null);
  };

  const handleDelete = (p: Project) => {
    if (!window.confirm(`Xóa dự án “${p.name}”? Các item sẽ được gỡ khỏi dự án (không xóa khỏi Gommo).`)) {
      return;
    }
    deleteProject(p.id);
    if (selected === p.id) setSelected(null);
  };

  return (
    <div className="page projects-page">
      <div className="projects-layout">
        <aside className="projects-sidebar">
          <div className="projects-create">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Tên dự án mới…"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <button type="button" onClick={handleCreate} aria-label="Tạo dự án">
              <Plus size={16} />
            </button>
          </div>

          <button
            type="button"
            className={`projects-nav-item${selected === null ? ' active' : ''}`}
            onClick={() => setSelected(null)}
          >
            <FolderOpen size={15} />
            <span className="projects-nav-name">Tất cả</span>
            <span className="projects-nav-count">{total}</span>
          </button>

          <div className="projects-nav-list">
            {projects.map((p) => (
              <div
                key={p.id}
                className={`projects-nav-item${selected === p.id ? ' active' : ''}`}
                onClick={() => setSelected(p.id)}
                role="button"
                tabIndex={0}
              >
                <span className="project-pick-dot" style={{ background: p.color }} />
                {editing === p.id ? (
                  <input
                    className="projects-edit-input"
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(p.id);
                      if (e.key === 'Escape') setEditing(null);
                    }}
                    onBlur={() => saveEdit(p.id)}
                  />
                ) : (
                  <span className="projects-nav-name">{p.name}</span>
                )}
                <span className="projects-nav-count">{counts[p.id] ?? 0}</span>
              </div>
            ))}
            {projects.length === 0 && (
              <p className="projects-sidebar-empty">Tạo dự án đầu tiên ở trên.</p>
            )}
          </div>
        </aside>

        <section className="projects-main">
          <header className="projects-main-head">
            <div className="projects-main-title">
              {selectedProject && (
                <span className="project-pick-dot" style={{ background: selectedProject.color }} />
              )}
              <h2>{selectedProject ? selectedProject.name : 'Tất cả nội dung'}</h2>
              {selectedProject && editing !== selectedProject.id && (
                <div className="projects-main-actions">
                  <button type="button" onClick={() => startEdit(selectedProject)} aria-label="Đổi tên">
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => handleDelete(selectedProject)}
                    aria-label="Xóa dự án"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>

            {selectedProject && (
              <div className="projects-color-row">
                {PROJECT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`projects-color${selectedProject.color === c ? ' active' : ''}`}
                    style={{ background: c }}
                    onClick={() => updateProject(selectedProject.id, { color: c })}
                    aria-label="Đổi màu"
                  >
                    {selectedProject.color === c && <Check size={12} />}
                  </button>
                ))}
              </div>
            )}

            <div className="projects-cats">
              {CATS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={cat === c.value ? 'active' : ''}
                  onClick={() => setCat(c.value)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </header>

          {items.length === 0 ? (
            <p className="muted projects-empty">
              Chưa có item nào. Vào tab “Của tôi” hoặc “Lịch sử”, bấm nút thư mục trên mỗi sản phẩm
              để thêm vào dự án.
            </p>
          ) : (
            <div className="projects-grid">
              {items.map((it) => (
                <article key={it.itemId} className="project-item">
                  <a
                    className="project-item-thumb"
                    href={it.downloadUrl || it.thumbnailUrl || '#'}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {renderMedia(it)}
                  </a>
                  <button
                    type="button"
                    className="project-item-remove"
                    aria-label="Bỏ khỏi dự án"
                    onClick={() => removeItem(it.itemId)}
                  >
                    <X size={14} />
                  </button>
                  {it.prompt && (
                    <p className="project-item-prompt" title={it.prompt}>
                      {it.prompt}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
