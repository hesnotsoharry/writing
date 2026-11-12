/**
 * ImportOutlineDialog.tsx — "Import file…" from the binder.
 *
 * Pick a .docx / .md / .txt → see what kinds of line were found and what each
 * becomes (chapter, scene, scene break, text), where text goes (synopsis or the
 * scene itself), the resulting tree, and the destination → import. Nothing is
 * written until the user confirms; every choice updates the preview live.
 */
import { type ReactElement, useMemo, useState } from "react";

import type { ImportOutlineResult, ImportTarget } from "./applyOutlinePlan";
import { type Destination,ImportPreview } from "./ImportPreview";
import { OutlineImportError, type OutlinePlan, planProblem } from "./outlinePlan";
import { type BodyMode, buildPlan, defaultRoles, guessBodyMode, type RoleMap } from "./pipeline/buildPlan";
import { type PickedFile, pickImportFile } from "./readImportFile";

export interface ImportOutlineDialogProps {
  /** Writes the plan into the binder (BinderCallbacks.onImportOutline). */
  onImport: (plan: OutlinePlan, target: ImportTarget) => Promise<ImportOutlineResult>;
  onClose: () => void;
  /** Injectable for tests; defaults to the native picker + readers. */
  pick?: () => Promise<PickedFile | null>;
}

/** "Salt Road outline.docx" → "Salt Road outline". */
export const titleFromFileName = (fileName: string) => fileName.replace(/\.[a-z]{2,8}$/i, "").trim();

function errorMessage(e: unknown): string {
  if (e instanceof OutlineImportError) return e.message;
  return `Something went wrong: ${e instanceof Error ? e.message : String(e)}`;
}

function Intro(): ReactElement {
  return (
    <div className="sheet-body">
      <p>Bring in an outline or a draft from a Word (.docx), Markdown (.md) or text (.txt) file.</p>
      <p>WritersNook finds the chapter and scene titles — Heading styles, lines like &ldquo;Chapter 7&rdquo;,
        bold or centred titles, scene breaks like &ldquo;* * *&rdquo;, or nested bullets. You&rsquo;ll see what it
        found and can change it before anything is added.</p>
      <p className="sheet-sub">Add it to the end of this manuscript (nothing already here changes) or start a new one.</p>
    </div>
  );
}

type Busy = null | "reading" | "importing";

interface Choices { roles: RoleMap; mode: BodyMode; dest: Destination }

function initialChoices(picked: PickedFile, prev: Destination): Choices {
  const c = picked.classification;
  return { roles: defaultRoles(c), mode: guessBodyMode(c), dest: { ...prev, title: titleFromFileName(picked.fileName) } };
}

function useImportFlow(p: ImportOutlineDialogProps) {
  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [choices, setChoices] = useState<Choices>({ roles: {}, mode: "synopsis", dest: { kind: "current", title: "" } });
  const plan = useMemo(() => (picked ? buildPlan(picked.classification, choices.roles, choices.mode) : null), [picked, choices]);
  async function choose() {
    setError(null); setBusy("reading");
    try {
      const next = await (p.pick ?? pickImportFile)();
      if (next) { setChoices((c) => initialChoices(next, c.dest)); setPicked(next); }
    } catch (e) { setError(errorMessage(e)); }
    setBusy(null);
  }
  async function confirm() {
    if (!plan) return;
    setError(null); setBusy("importing");
    const dest = choices.dest;
    try { await p.onImport(plan, dest.kind === "new" ? { kind: "new", title: dest.title.trim() } : { kind: "current" }); p.onClose(); }
    catch (e) { setError(errorMessage(e)); setBusy(null); }
  }
  return { picked, plan, busy, error, choices, setChoices, choose, confirm };
}

type Flow = ReturnType<typeof useImportFlow>;

function canImportNow(f: Flow, problem: string | null): boolean {
  const titled = f.choices.dest.kind === "current" || f.choices.dest.title.trim() !== "";
  return f.busy === null && !!f.plan && !problem && titled;
}

function Body({ f }: { f: Flow }): ReactElement {
  const { choices, setChoices } = f;
  if (!f.picked || !f.plan) return <Intro />;
  return (
    <ImportPreview fileName={f.picked.fileName} groups={f.picked.classification.groups} plan={f.plan}
      roles={choices.roles} setRoles={(roles) => setChoices({ ...choices, roles })}
      mode={choices.mode} setMode={(mode) => setChoices({ ...choices, mode })}
      dest={choices.dest} setDest={(dest) => setChoices({ ...choices, dest })} />
  );
}

export function ImportOutlineDialog(p: ImportOutlineDialogProps): ReactElement {
  const f = useImportFlow(p);
  const problem = f.plan ? planProblem(f.plan) : null;
  const canImport = canImportNow(f, problem);
  return (
    <div className="scrim" role="presentation" style={{ position: "fixed", zIndex: 100 }} onMouseDown={f.busy ? undefined : p.onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="import-outline-title"
        style={{ width: 600, maxWidth: "calc(100vw - 32px)" }} onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === "Escape" && !f.busy) { e.preventDefault(); p.onClose(); } }}>
        <div className="sheet-head"><div className="sheet-title" id="import-outline-title">Import a file</div></div>
        <Body f={f} />
        {(f.error ?? problem) && <p className="byok-key-error" role="alert" style={{ padding: "0 20px" }}>{f.error ?? problem}</p>}
        <Footer picked={!!f.picked} busy={f.busy} canImport={canImport} onClose={p.onClose}
          onChoose={() => { void f.choose(); }} onConfirm={() => { void f.confirm(); }} />
      </div>
    </div>
  );
}

interface FooterProps { picked: boolean; busy: Busy; canImport: boolean; onClose: () => void; onChoose: () => void; onConfirm: () => void }

function Footer({ picked, busy, canImport, onClose, onChoose, onConfirm }: FooterProps): ReactElement {
  return (
    <div className="sheet-foot" style={{ justifyContent: "flex-end" }}>
      <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy !== null}>Cancel</button>
      {picked && !busy && <button type="button" className="btn btn-ghost" onClick={onChoose}>Choose another file</button>}
      {picked
        ? <button type="button" className="btn btn-primary" disabled={!canImport} onClick={onConfirm}>{busy === "importing" ? "Importing…" : "Import"}</button>
        : <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={onChoose}>{busy === "reading" ? "Reading…" : "Choose file…"}</button>}
    </div>
  );
}
