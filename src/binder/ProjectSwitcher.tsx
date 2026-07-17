import { useEffect, useRef, useState } from "react";

import { Icon } from "../components/Icon";
import type { Project } from "../db/binderStore";

/** Returns next index clamped to [0, count-1]. Exported for unit tests. */
export function clampIndex(next: number, count: number): number {
  if (count <= 0) return 0;
  if (next < 0) return 0;
  if (next >= count) return count - 1;
  return next;
}

interface ProjectSwitcherProps {
  projects: Project[];
  activeProjectId: string | null;
  onSwitchProject: (projectId: string) => void;
  onCreateProject: (title: string) => void;
  activeWords?: number;
}

function typeLabel(p: Project): string {
  return p.type === "novel" ? "Novel" : "Collection";
}

function subtitle(p: Project, activeProjectId: string | null, activeWords?: number): string {
  if (p.id === activeProjectId && activeWords != null) {
    return `${typeLabel(p)} · ${activeWords.toLocaleString()} words`;
  }
  return typeLabel(p);
}

interface MenuNavState {
  activeIndex: number;
  itemCount: number;
  itemRefs: React.MutableRefObject<(HTMLButtonElement | null)[]>;
  setActiveIndex: (n: number) => void;
  onClose: () => void;
  onFocusTrigger: () => void;
}

function menuKeyDown(nav: MenuNavState, e: React.KeyboardEvent): void {
  if (e.key === "Escape") { e.preventDefault(); nav.onClose(); nav.onFocusTrigger(); return; }
  const delta = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
  if (!delta) return;
  e.preventDefault();
  const next = clampIndex(nav.activeIndex + delta, nav.itemCount);
  nav.setActiveIndex(next);
  nav.itemRefs.current[next]?.focus();
}

interface ProjMenuProps {
  projects: Project[];
  activeProjectId: string | null;
  activeWords?: number;
  onSwitch: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
  onFocusTrigger: () => void;
}

function ProjMenu({ projects, activeProjectId, activeWords, onSwitch, onNew, onClose, onFocusTrigger }: ProjMenuProps) {
  const itemCount = projects.length + 1;
  const initialIndex = Math.max(0, projects.findIndex((p) => p.id === activeProjectId));
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { itemRefs.current[initialIndex]?.focus(); }, []);
  const onKey = (e: React.KeyboardEvent) => menuKeyDown({ activeIndex, itemCount, itemRefs, setActiveIndex, onClose, onFocusTrigger }, e);
  return (
    <>
      <div className="cm-backdrop" style={{ zIndex: 49 }} onMouseDown={onClose} />
      <div className="proj-menu">
        {projects.map((p, i) => {
          const isActive = p.id === activeProjectId;
          return (
            <button key={p.id} ref={(el) => { itemRefs.current[i] = el; }}
              className={"proj-item" + (isActive ? " on" : "")}
              onKeyDown={onKey} onClick={() => { onSwitch(p.id); onClose(); }}>
              <div className="pc" />
              <div className="pm">
                <div className="pt">{p.title}</div>
                <div className="ps">{subtitle(p, activeProjectId, activeWords)}</div>
              </div>
              {isActive && <Icon name="check" className="tick" style={{ width: 16, height: 16 }} />}
            </button>
          );
        })}
        <div className="cm-sep" />
        <button ref={(el) => { itemRefs.current[projects.length] = el; }} className="proj-new"
          onKeyDown={onKey} onClick={() => { onNew(); onClose(); }}>
          <Icon name="plus" className="ic" /> New manuscript…
        </button>
      </div>
    </>
  );
}

interface CreateProjectDialogProps {
  title: string;
  onTitleChange: (title: string) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}

function CreateProjectDialog({ title, onTitleChange, onSubmit, onClose }: CreateProjectDialogProps) {
  return (
    <div className="scrim" role="presentation" style={{ position: "fixed", zIndex: 100 }} onMouseDown={onClose}>
      <form className="sheet" role="dialog" aria-modal="true" aria-labelledby="new-manuscript-title"
        onSubmit={onSubmit} onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); onClose(); } }}>
        <div className="sheet-head">
          <div>
            <div className="sheet-title" id="new-manuscript-title">New manuscript</div>
            <div className="sheet-sub">Give your manuscript a title to get started.</div>
          </div>
        </div>
        <div className="sheet-body">
          <label className="field-label" htmlFor="new-manuscript-name">Title</label>
          <div className="fr-field">
            <input id="new-manuscript-name" autoFocus value={title}
              onChange={(e) => onTitleChange(e.target.value)} placeholder="Untitled manuscript" />
          </div>
        </div>
        <div className="sheet-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={!title.trim()}>Create manuscript</button>
        </div>
      </form>
    </div>
  );
}

interface ProjectSwitcherSurfaceProps extends ProjectSwitcherProps {
  open: boolean;
  createOpen: boolean;
  createTitle: string;
  active: Project | undefined;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setCreateOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setCreateTitle: React.Dispatch<React.SetStateAction<string>>;
}

function ProjectSwitcherSurface({ projects, activeProjectId, onSwitchProject, onCreateProject,
  activeWords, open, createOpen, createTitle, active, setOpen, setCreateOpen, setCreateTitle }: ProjectSwitcherSurfaceProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  function handleTriggerKeyDown(e: React.KeyboardEvent): void {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setOpen(true); }
  }
  function openCreateProject(): void { setCreateTitle(""); setCreateOpen(true); }
  function submitCreateProject(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault(); const title = createTitle.trim();
    if (!title) return; onCreateProject(title); setCreateOpen(false);
  }
  return (
    <div className="project-switch" style={{ position: "relative" }}>
      <button ref={triggerRef} className="proj-btn"
        onClick={() => setOpen((o) => !o)} onKeyDown={handleTriggerKeyDown}>
        <div className="proj-cover" />
        <div className="proj-meta">
          <div className="proj-title">{active?.title}</div>
          <div className="proj-sub">{active ? subtitle(active, activeProjectId, activeWords) : ""}</div>
        </div>
        <Icon name="chevDown" className="proj-chev" style={{ width: 15, height: 15 }} />
      </button>
      {open && (
        <ProjMenu
          projects={projects}
          activeProjectId={activeProjectId}
          activeWords={activeWords}
          onSwitch={onSwitchProject}
          onNew={openCreateProject}
          onClose={() => setOpen(false)}
          onFocusTrigger={() => triggerRef.current?.focus()}
        />
      )}
      {createOpen && <CreateProjectDialog title={createTitle} onTitleChange={setCreateTitle}
        onSubmit={submitCreateProject} onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

export function ProjectSwitcher(props: ProjectSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const active = props.projects.find((p) => p.id === props.activeProjectId) ?? props.projects[0];
  return <ProjectSwitcherSurface {...props} open={open} createOpen={createOpen} createTitle={createTitle}
    active={active} setOpen={setOpen} setCreateOpen={setCreateOpen} setCreateTitle={setCreateTitle} />;
}
