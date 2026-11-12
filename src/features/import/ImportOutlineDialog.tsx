/**
 * ImportOutlineDialog.tsx — "Import outline…" from the binder.
 *
 * Pick a .docx → preview the chapters and scenes it will create → append them to
 * the end of the current manuscript. Nothing is written until the user confirms.
 */
import { type ReactElement, useState } from "react";

import type { ImportOutlineResult } from "./applyOutlinePlan";
import { OutlineImportError, type OutlinePlan, sceneCount } from "./outlinePlan";
import { pickDocxOutline,type PickedOutline } from "./readDocxOutline";

export interface ImportOutlineDialogProps {
  /** Writes the plan into the binder (BinderCallbacks.onImportOutline). */
  onImport: (plan: OutlinePlan) => Promise<ImportOutlineResult>;
  onClose: () => void;
  /** Injectable for tests; defaults to the native picker + .docx reader. */
  pick?: () => Promise<PickedOutline | null>;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function errorMessage(e: unknown): string {
  if (e instanceof OutlineImportError) return e.message;
  return `Something went wrong: ${e instanceof Error ? e.message : String(e)}`;
}

function Intro(): ReactElement {
  return (
    <div className="sheet-body">
      <p>Bring in an outline from a Word document (.docx). It&rsquo;s added to the end of this manuscript — nothing
        already here changes.</p>
      <ul>
        <li><strong>Heading 1</strong> lines become chapters.</li>
        <li><strong>Heading 2</strong> lines become scenes in that chapter.</li>
        <li>Text under a scene heading becomes the scene&rsquo;s synopsis, marked <em>Outline</em>.</li>
      </ul>
      <p className="sheet-sub">No headings? A bulleted list works too: top bullets become chapters, indented
        bullets become scenes.</p>
    </div>
  );
}

function Preview({ picked }: { picked: PickedOutline }): ReactElement {
  const { plan } = picked;
  return (
    <div className="sheet-body">
      <p><strong>{picked.fileName}</strong> — {plural(plan.chapters.length, "chapter")}, {plural(sceneCount(plan), "scene")}.</p>
      <ol className="import-outline-preview" style={{ maxHeight: 260, overflowY: "auto", paddingLeft: 20 }}>
        {plan.chapters.map((ch, i) => (
          <li key={i}>
            <strong>{ch.title}</strong>
            {ch.scenes.length > 0 && <ul>{ch.scenes.map((s, j) => <li key={j}>{s.title}</li>)}</ul>}
          </li>
        ))}
      </ol>
      {plan.notes && <p className="sheet-sub">Text before the first heading goes into an &ldquo;Outline notes&rdquo; short piece.</p>}
    </div>
  );
}

type Phase = { kind: "intro" } | { kind: "preview"; picked: PickedOutline } | { kind: "busy"; picked: PickedOutline | null };

function useImportFlow(p: ImportOutlineDialogProps) {
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  const [error, setError] = useState<string | null>(null);
  async function choose() {
    setError(null); setPhase({ kind: "busy", picked: null });
    try {
      const picked = await (p.pick ?? pickDocxOutline)();
      setPhase(picked ? { kind: "preview", picked } : { kind: "intro" });
    } catch (e) { setError(errorMessage(e)); setPhase({ kind: "intro" }); }
  }
  async function confirm(picked: PickedOutline) {
    setError(null); setPhase({ kind: "busy", picked });
    try { await p.onImport(picked.plan); p.onClose(); }
    catch (e) { setError(errorMessage(e)); setPhase({ kind: "preview", picked }); }
  }
  return { phase, error, choose, confirm };
}

export function ImportOutlineDialog(p: ImportOutlineDialogProps): ReactElement {
  const { phase, error, choose, confirm } = useImportFlow(p);
  const picked = phase.kind === "intro" ? null : phase.picked;
  const busy = phase.kind === "busy";
  return (
    <div className="scrim" role="presentation" style={{ position: "fixed", zIndex: 100 }} onMouseDown={busy ? undefined : p.onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="import-outline-title"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === "Escape" && !busy) { e.preventDefault(); p.onClose(); } }}>
        <div className="sheet-head"><div className="sheet-title" id="import-outline-title">Import outline</div></div>
        {picked ? <Preview picked={picked} /> : <Intro />}
        {error && <p className="byok-key-error" role="alert" style={{ padding: "0 20px" }}>{error}</p>}
        <div className="sheet-foot">
          <button type="button" className="btn btn-ghost" onClick={p.onClose} disabled={busy}>Cancel</button>
          {picked && phase.kind !== "busy" && <button type="button" className="btn btn-ghost" onClick={() => { void choose(); }}>Choose another file</button>}
          {picked
            ? <button type="button" className="btn btn-primary" disabled={busy} onClick={() => { void confirm(picked); }}>{busy ? "Importing…" : "Import"}</button>
            : <button type="button" className="btn btn-primary" disabled={busy} onClick={() => { void choose(); }}>{busy ? "Reading…" : "Choose Word file…"}</button>}
        </div>
      </div>
    </div>
  );
}
