import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, FolderOpen, Pencil, Plus, Sparkles, Trash2, Workflow, X } from 'lucide-react';
import {
  countByProject,
  createProject,
  deleteProject,
  getItemProjectId,
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
import { getTemplate } from '../services/workflowLibraryStore';

type CatFilter = 'all' | 'image' | 'video' | 'tts' | 'music' | 'chat' | 'workflow';

const CATS: { value: CatFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'image', label: 'Ảnh' },
  { value: 'video', label: 'Video' },
  { value: 'tts', label: 'Audio' },
  { value: 'music', label: 'Nhạc' },
  { value: 'chat', label: 'Chat' },
  { value: 'workflow', label: 'Workflow' },
];

function itemLink(it: ProjectItem): string | null {
  if (it.type === 'chat') return `/chat?session=${encodeURIComponent(it.itemId)}`;
  if (it.type === 'workflow') return `/workflow?template=${encodeURIComponent(it.itemId)}`;
  return it.downloadUrl || it.thumbnailUrl || null;
}

function isAppItem(it: ProjectItem): it is ProjectItem & { type: 'chat' | 'workflow' } {
  return it.type === 'chat' || it.type === 'workflow';
}

function itemAccentColor(it: ProjectItem, projects: Project[]): string | undefined {
  const pid = getItemProjectId(it.itemId);
  return projects.find((p) => p.id === pid)?.color;
}

function appItemMeta(it: ProjectItem): string {
  if (it.type === 'workflow') {
    const t = getTemplate(it.itemId);
    return t ? `${t.nodeCount} node` : 'Workflow đã lưu';
  }
  return 'Đoạn chat';
}

function appItemTitle(it: ProjectItem): string {
  return it.prompt?.trim() || (it.type === 'chat' ? 'Đoạn chat' : 'Workflow');
}

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
    if (!window.confirm(`Xóa dự án “${p.name}”? Các item sẽ được gỡ khỏi dự án (không xóa khỏi thư viện).`)) {
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
              Chưa có item nào. Bấm nút thư mục trên sản phẩm (Lịch sử), đoạn chat (Chat), workflow
              đã lưu (Thư viện Workflow), hoặc output workflow để thêm vào dự án.
            </p>
          ) : (
            <div className="projects-grid">
              {items.map((it) => {
                const link = itemLink(it);
                if (isAppItem(it) && link) {
                  const accent = itemAccentColor(it, projects) ?? selectedProject?.color;
                  return (
                    <article
                      key={it.itemId}
                      className={`project-item project-item--app project-item--${it.type}`}
                    >
                      <Link
                        className="project-item-app-link"
                        to={link}
                        style={{
                          ['--project-accent' as string]:
                            accent ?? (it.type === 'workflow' ? '#60a5fa' : '#53eb67'),
                        }}
                      >
                        <div className="project-item-app-thumb">
                          {accent && (
                            <span className="project-item-app-dot" style={{ background: accent }} />
                          )}
                          <span className="project-item-app-badge">
                            {it.type === 'chat' ? 'Chat' : 'Workflow'}
                          </span>
                          <span className="project-item-app-icon-wrap" aria-hidden>
                            {it.type === 'chat' ? <Sparkles size={20} /> : <Workflow size={20} />}
                          </span>
                        </div>
                        <div className="project-item-app-body">
                          <p className="project-item-app-title" title={appItemTitle(it)}>
                            {appItemTitle(it)}
                          </p>
                          <p className="project-item-app-meta">{appItemMeta(it)}</p>
                        </div>
                      </Link>
                      <button
                        type="button"
                        className="project-item-remove"
                        aria-label="Bỏ khỏi dự án"
                        onClick={() => removeItem(it.itemId)}
                      >
                        <X size={14} />
                      </button>
                    </article>
                  );
                }
                return (
                <article key={it.itemId} className="project-item">
                  {link ? (
                    <a
                      className="project-item-thumb"
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {renderMedia(it)}
                    </a>
                  ) : (
                    <div className="project-item-thumb">{renderMedia(it)}</div>
                  )}
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
              );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
