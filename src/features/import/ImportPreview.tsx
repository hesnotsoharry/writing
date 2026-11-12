/**
 * ImportPreview.tsx — the import dialog's preview: what kinds of line were found
 * and what each becomes, where text goes, the resulting tree, and the destination.
 */
import type { ReactElement } from "react";

import type { ImportTarget } from "./applyOutlinePlan";
import { type OutlinePlan, sceneCount } from "./outlinePlan";
import type { BodyMode, RoleMap } from "./pipeline/buildPlan";
import type { LineGroup, Role } from "./pipeline/classify";

export interface Destination { kind: ImportTarget["kind"]; title: string }

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const ROLE_LABEL: Record<Role, string> = { chapter: "Chapter", scene: "Scene", text: "Text", split: "New scene" };
const OPTIONS: Record<"break" | "other", Role[]> = { break: ["split", "text"], other: ["chapter", "scene", "text"] };

function GroupRow({ group, role, onRole }: { group: LineGroup; role: Role; onRole: (r: Role) => void }): ReactElement {
  const options = OPTIONS[group.kind === "break" ? "break" : "other"];
  return (
    <li className="import-group" style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "6px 0" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div>{group.label} <span className="sheet-sub">({group.lines.length})</span></div>
        <div className="sheet-sub" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {group.examples.map((e) => `“${e}”`).join(", ")}
        </div>
      </div>
      <select aria-label={`${group.label} become`} value={role} onChange={(e) => onRole(e.target.value as Role)}>
        {options.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
      </select>
    </li>
  );
}

function Mapping({ groups, roles, setRoles }: { groups: LineGroup[]; roles: RoleMap; setRoles: (r: RoleMap) => void }): ReactElement {
  if (groups.length === 0) {
    return <p className="sheet-sub">No chapter or scene titles found, so everything comes in as one scene. To split it up,
      mark titles with Word&rsquo;s Heading 1 and Heading 2 styles, or start lines with &ldquo;Chapter&rdquo;.</p>;
  }
  return (
    <ul aria-label="What each kind of line becomes" style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: 200, overflowY: "auto" }}>
      {groups.map((g) => (
        <GroupRow key={g.key} group={g} role={roles[g.key] ?? g.role} onRole={(r) => setRoles({ ...roles, [g.key]: r })} />
      ))}
    </ul>
  );
}

function Radio({ name, checked, onChange, children }: { name: string; checked: boolean; onChange: () => void; children: string }) {
  return <label style={{ display: "block", marginTop: 4 }}><input type="radio" name={name} checked={checked} onChange={onChange} /> {children}</label>;
}

function BodyChoice({ mode, setMode }: { mode: BodyMode; setMode: (m: BodyMode) => void }): ReactElement {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: "12px 0 0" }}>
      <legend className="sheet-sub" style={{ padding: 0 }}>Text under each scene goes into</legend>
      <Radio name="import-body" checked={mode === "synopsis"} onChange={() => setMode("synopsis")}>The scene&rsquo;s synopsis (an outline)</Radio>
      <Radio name="import-body" checked={mode === "scene"} onChange={() => setMode("scene")}>The scene itself (a draft)</Radio>
    </fieldset>
  );
}

function Tree({ plan }: { plan: OutlinePlan }): ReactElement {
  return (
    <ol className="import-outline-preview" aria-label="Preview" style={{ maxHeight: 180, overflowY: "auto", paddingLeft: 20, marginTop: 12 }}>
      {plan.chapters.map((ch, i) => (
        <li key={i}><strong>{ch.title}</strong>
          {ch.scenes.length > 0 && <ul>{ch.scenes.map((s, j) => <li key={j}>{s.title}</li>)}</ul>}
        </li>
      ))}
      {plan.notes && <li><em>{plan.notes.title}</em> <span className="sheet-sub">(short piece)</span></li>}
    </ol>
  );
}

function DestinationChoice({ dest, setDest }: { dest: Destination; setDest: (d: Destination) => void }): ReactElement {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: "12px 0 0" }}>
      <legend className="sheet-sub" style={{ padding: 0 }}>Import into</legend>
      <Radio name="import-dest" checked={dest.kind === "current"} onChange={() => setDest({ ...dest, kind: "current" })}>The end of this manuscript</Radio>
      <Radio name="import-dest" checked={dest.kind === "new"} onChange={() => setDest({ ...dest, kind: "new" })}>A new manuscript</Radio>
      {dest.kind === "new" && (
        <div className="fr-field" style={{ marginTop: 6 }}>
          <input aria-label="New manuscript title" value={dest.title} maxLength={200} placeholder="Untitled manuscript"
            onChange={(e) => setDest({ ...dest, title: e.target.value })} />
        </div>
      )}
    </fieldset>
  );
}

export interface PreviewProps {
  fileName: string; groups: LineGroup[]; plan: OutlinePlan;
  roles: RoleMap; setRoles: (r: RoleMap) => void;
  mode: BodyMode; setMode: (m: BodyMode) => void;
  dest: Destination; setDest: (d: Destination) => void;
}

export function ImportPreview(p: PreviewProps): ReactElement {
  return (
    <div className="sheet-body">
      <p><strong>{p.fileName}</strong> — {plural(p.plan.chapters.length, "chapter")}, {plural(sceneCount(p.plan), "scene")}.</p>
      <Mapping groups={p.groups} roles={p.roles} setRoles={p.setRoles} />
      <BodyChoice mode={p.mode} setMode={p.setMode} />
      <Tree plan={p.plan} />
      <DestinationChoice dest={p.dest} setDest={p.setDest} />
    </div>
  );
}
