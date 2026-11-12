/**
 * ImportOutlineDialog.tsx — "Import outline…" from the binder.
 *
 * Pick a .docx → preview the chapters and scenes it will create → choose where
 * they go (end of this manuscript, or a new manuscript) → import. Nothing is
 * written until the user confirms.
 */
import { type ReactElement, useState } from "react";

import type { ImportOutlineResult, ImportTarget } from "./applyOutlinePlan";
import { OutlineImportError, type OutlinePlan, sceneCount } from "./outlinePlan";
import { pickDocxOutline, type PickedOutline } from "./readDocxOutline";

export interface ImportOutlineDialogProps {
  /** Writes the plan into the binder (BinderCallbacks.onImportOutline). */
  onImport: (plan: OutlinePlan, target: ImportTarget) => Promise<ImportOutlineResult>;
  onClose: () => void;
  /** Injectable for tests; defaults to the native picker + .docx reader. */
  pick?: () => Promise<PickedOutline | null>;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** "Salt Road outline.docx" → "Salt Road outline". */
export const titleFromFileName = (fileName: string) => fileName.replace(/\.docx$/i, "").trim();

function errorMessage(e: unknown): string {
  if (e instanceof OutlineImportError) return e.message;
  return `Something went wrong: ${e instanceof Error ? e.message : String(e)}`;
}

function Intro(): ReactElement {
  return (
    <div className="sheet-body">
      <p>Bring in an outline from a Word document (.docx). Add it to the end of this manuscript —
        nothing already here changes — or start a new manuscript from it.</p>
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

interface Destination { kind: ImportTarget["kind"]; title: string }

function DestinationChoice({ dest, setDest }: { dest: Destination; setDest: (d: Destination) => void }): ReactElement {
  return (
    <fieldset className="import-outline-dest" style={{ border: 0, padding: 0, margin: "12px 0 0" }}>
      <legend className="sheet-sub" style={{ padding: 0 }}>Import into</legend>
      <label style={{ display: "block", marginTop: 6 }}>
        <input type="radio" name="import-dest" checked={dest.kind === "current"}
          onChange={() => setDest({ ...dest, kind: "current" })} /> The end of this manuscript
      </label>
      <label style={{ display: "block", marginTop: 4 }}>
        <input type="radio" name="import-dest" checked={dest.kind === "new"}
          onChange={() => setDest({ ...dest, kind: "new" })} /> A new manuscript
      </label>
      {dest.kind === "new" && (
        <div className="fr-field" style={{ marginTop: 6 }}>
          <input aria-label="New manuscript title" value={dest.title} maxLength={200} placeholder="Untitled manuscript"
            onChange={(e) => setDest({ ...dest, title: e.target.value })} />
        </div>
      )}
    </fieldset>
  );
}

function Preview({ picked, dest, setDest }: { picked: PickedOutline; dest: Destination; setDest: (d: Destination) => void }): ReactElement {
  const { plan } = picked;
  return (
    <div className="sheet-body">
      <p><strong>{picked.fileName}</strong> — {plural(plan.chapters.length, "chapter")}, {plural(sceneCount(plan), "scene")}.</p>
      <ol className="import-outline-preview" style={{ maxHeight: 220, overflowY: "auto", paddingLeft: 20 }}>
        {plan.chapters.map((ch, i) => (
          <li key={i}>
            <strong>{ch.title}</strong>
            {ch.scenes.length > 0 && <ul>{ch.scenes.map((s, j) => <li key={j}>{s.title}</li>)}</ul>}
          </li>
        ))}
      </ol>
      {plan.notes && <p className="sheet-sub">Text before the first heading goes into an &ldquo;Outline notes&rdquo; short piece.</p>}
      <DestinationChoice dest={dest} setDest={setDest} />
    </div>
  );
}

type Phase = { kind: "intro" } | { kind: "preview"; picked: PickedOutline } | { kind: "busy"; picked: PickedOutline | null };

const toTarget = (d: Destination): ImportTarget => (d.kind === "new" ? { kind: "new", title: d.title.trim() } : { kind: "current" });

function useImportFlow(p: ImportOutlineDialogProps) {
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  const [error, setError] = useState<string | null>(null);
  const [dest, setDest] = useState<Destination>({ kind: "current", title: "" });
  async function choose() {
    setError(null); setPhase({ kind: "busy", picked: null });
    try {
      const picked = await (p.pick ?? pickDocxOutline)();
      if (picked) setDest((d) => ({ ...d, title: titleFromFileName(picked.fileName) }));
      setPhase(picked ? { kind: "preview", picked } : { kind: "intro" });
    } catch (e) { setError(errorMessage(e)); setPhase({ kind: "intro" }); }
  }
  async function confirm(picked: PickedOutline) {
    setError(null); setPhase({ kind: "busy", picked });
    try { await p.onImport(picked.plan, toTarget(dest)); p.onClose(); }
    catch (e) { setError(errorMessage(e)); setPhase({ kind: "preview", picked }); }
  }
  return { phase, error, dest, setDest, choose, confirm };
}

export function ImportOutlineDialog(p: ImportOutlineDialogProps): ReactElement {
  const { phase, error, dest, setDest, choose, confirm } = useImportFlow(p);
  const picked = phase.kind === "intro" ? null : phase.picked;  const busy = phase.kind === "busy";
  const canImport = !busy && (dest.kind === "current" || dest.title.trim() !== "");
  return (
    <div className="scrim" role="presentation" style={{ position: "fixed", zIndex: 100 }} onMouseDown={busy ? undefined : p.onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="import-outline-title"
        style={{ width: 520, maxWidth: "calc(100vw - 32px)" }}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === "Escape" && !busy) { e.preventDefault(); p.onClose(); } }}>
        <div className="sheet-head"><div className="sheet-title" id="import-outline-title">Import outline</div></div>
        {picked ? <Preview picked={picked} dest={dest} setDest={setDest} /> : <Intro />}
        {error && <p className="byok-key-error" role="alert" style={{ padding: "0 20px" }}>{error}</p>}
        <Footer picked={picked} busy={busy} canImport={canImport} onClose={p.onClose}
          onChoose={() => { void choose(); }} onConfirm={(pk) => { void confirm(pk); }} />
      </div>
    </div>
  );
}

interface FooterProps {
  picked: PickedOutline | null; busy: boolean; canImport: boolean;
  onClose: () => void; onChoose: () => void; onConfirm: (picked: PickedOutline) => void;
}

function Footer({ picked, busy, canImport, onClose, onChoose, onConfirm }: FooterProps): ReactElement {
  return (
    <div className="sheet-foot" style={{ justifyContent: "flex-end" }}>
      <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
      {picked && !busy && <button type="button" className="btn btn-ghost" onClick={onChoose}>Choose another file</button>}
      {picked
        ? <button type="button" className="btn btn-primary" disabled={!canImport} onClick={() => onConfirm(picked)}>{busy ? "Importing…" : "Import"}</button>
        : <button type="button" className="btn btn-primary" disabled={busy} onClick={onChoose}>{busy ? "Reading…" : "Choose Word file…"}</button>}
    </div>
  );
}
