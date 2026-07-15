import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, FolderPlus, Plus, X } from 'lucide-react';
import {
  assignItem,
  createProject,
  getItemProjectId,
  loadProjects,
  onProjectsUpdated,
  removeItem,
  type Project,
  type ProjectItemSnapshot,
} from '../services/projectStore';

interface PanelPos {
  top: number;
  left: number;
  width: number;
}

export default function ProjectPicker({
  snapshot,
  className,
}: {
  snapshot: ProjectItemSnapshot;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState<PanelPos | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const refresh = () => {
    setProjects(loadProjects());
    setCurrentId(getItemProjectId(snapshot.itemId));
  };

  useEffect(() => {
    refresh();
    return onProjectsUpdated(refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.itemId]);

  const computePos = () => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = 240;
    let left = r.right - width;
    if (left < 8) left = 8;
    if (left + width > window.innerWidth - 8) left = window.innerWidth - 8 - width;
    setPos({ top: r.bottom + 6, left, width });
  };

  useLayoutEffect(() => {
    if (open) computePos();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (
        panelRef.current?.contains(e.target as Node) ||
        btnRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  const current = useMemo(
    () => projects.find((p) => p.id === currentId) || null,
    [projects, currentId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [projects, query]);

  const exactMatch = useMemo(
    () => projects.some((p) => p.name.trim().toLowerCase() === query.trim().toLowerCase()),
    [projects, query],
  );

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen((v) => !v);
  };

  const pick = (projectId: string) => {
    if (currentId === projectId) {
      removeItem(snapshot.itemId);
    } else {
      assignItem(snapshot, projectId);
    }
    setOpen(false);
  };

  const handleCreate = () => {
    const name = query.trim();
    if (!name) return;
    const project = createProject(name);
    assignItem(snapshot, project.id);
    setQuery('');
    setOpen(false);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`project-pick-btn${current ? ' assigned' : ''}${className ? ` ${className}` : ''}`}
        onClick={handleToggle}
        title={current ? `Trong dự án: ${current.name}` : 'Thêm vào dự án'}
      >
        {current ? (
          <span className="project-pick-dot" style={{ background: current.color }} />
        ) : (
          <FolderPlus size={15} />
        )}
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            className="project-pick-panel"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="project-pick-search">
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm hoặc tạo dự án…"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && query.trim() && !exactMatch) handleCreate();
                }}
              />
            </div>

            <div className="project-pick-list">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="project-pick-item"
                  onClick={() => pick(p.id)}
                >
                  <span className="project-pick-dot" style={{ background: p.color }} />
                  <span className="project-pick-name">{p.name}</span>
                  {currentId === p.id && <Check size={14} className="project-pick-check" />}
                </button>
              ))}
              {filtered.length === 0 && !query.trim() && (
                <p className="project-pick-empty">Chưa có dự án nào.</p>
              )}
            </div>

            {query.trim() && !exactMatch && (
              <button type="button" className="project-pick-create" onClick={handleCreate}>
                <Plus size={14} /> Tạo dự án “{query.trim()}”
              </button>
            )}

            {current && (
              <button
                type="button"
                className="project-pick-remove"
                onClick={() => {
                  removeItem(snapshot.itemId);
                  setOpen(false);
                }}
              >
                <X size={14} /> Bỏ khỏi “{current.name}”
              </button>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
