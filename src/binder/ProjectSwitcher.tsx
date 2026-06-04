// @vitest-environment jsdom
import { useState } from "react";

import { Icon } from "../components/Icon";
import type { Project } from "../db/binderStore";

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

interface ProjMenuProps {
  projects: Project[];
  activeProjectId: string | null;
  activeWords?: number;
  onSwitch: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
}

function ProjMenu({ projects, activeProjectId, activeWords, onSwitch, onNew, onClose }: ProjMenuProps) {
  return (
    <>
      <div className="cm-backdrop" style={{ zIndex: 49 }} onMouseDown={onClose} />
      <div className="proj-menu">
        {projects.map((p) => {
          const isActive = p.id === activeProjectId;
          return (
            <button
              key={p.id}
              className={"proj-item" + (isActive ? " on" : "")}
              onClick={() => { onSwitch(p.id); onClose(); }}
            >
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
        <button className="proj-new" onClick={() => { onNew(); onClose(); }}>
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
  const active = projects.find((p) => p.id === activeProjectId) ?? projects[0];

  return (
    <div className="project-switch" style={{ position: "relative" }}>
      <button className="proj-btn" onClick={() => setOpen((o) => !o)}>
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
        />
      )}
    </div>
  );
}
