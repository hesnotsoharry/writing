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
    <div style={containerStyle}>
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

const containerStyle: React.CSSProperties = {
  padding: "8px 8px 4px",
  borderBottom: "1px solid #e0e0e0",
  marginBottom: 8,
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  fontSize: 13,
  fontWeight: 600,
  color: "#333",
  background: "#fff",
  border: "1px solid #ddd",
  borderRadius: 4,
  padding: "4px 6px",
  cursor: "pointer",
  appearance: "auto",
};
