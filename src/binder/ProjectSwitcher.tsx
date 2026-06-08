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
  onCreateProject: () => void;
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

export function ProjectSwitcher({
  projects,
  activeProjectId,
  onSwitchProject,
  onCreateProject,
  activeWords,
}: ProjectSwitcherProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const active = projects.find((p) => p.id === activeProjectId) ?? projects[0];
  function handleTriggerKeyDown(e: React.KeyboardEvent): void {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setOpen(true); }
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
          onNew={onCreateProject}
          onClose={() => setOpen(false)}
          onFocusTrigger={() => triggerRef.current?.focus()}
        />
      )}
    </div>
  );
}
