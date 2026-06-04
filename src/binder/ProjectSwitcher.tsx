/**
 * ProjectSwitcher — renders at the top of the binder pane.
 *
 * Shows the active project's title via a <select> listing all projects,
 * plus a "+ New project" option that triggers project creation.
 */
import type { Project } from "../db/binderStore";

interface ProjectSwitcherProps {
  projects: Project[];
  activeProjectId: string | null;
  onSwitchProject: (projectId: string) => void;
  onCreateProject: () => void;
}

const NEW_PROJECT_SENTINEL = "__new__";

export function ProjectSwitcher({
  projects,
  activeProjectId,
  onSwitchProject,
  onCreateProject,
}: ProjectSwitcherProps) {
  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    if (value === NEW_PROJECT_SENTINEL) {
      onCreateProject();
    } else {
      onSwitchProject(value);
    }
  }

  return (
    <div className="project-switch">
      <select
        value={activeProjectId ?? ""}
        onChange={handleChange}
        style={selectStyle}
        aria-label="Switch project"
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
          </option>
        ))}
        <option value={NEW_PROJECT_SENTINEL}>+ New project</option>
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const selectStyle: React.CSSProperties = {
  width: "100%",
  fontSize: "var(--text-sm)",
  fontWeight: "var(--w-semi)",
  color: "var(--ink)",
  background: "var(--paper)",
  border: "1px solid var(--line)",
  borderRadius: "var(--r-xs)",
  padding: "var(--s-1) var(--s-2)",
  cursor: "pointer",
  appearance: "auto",
};
