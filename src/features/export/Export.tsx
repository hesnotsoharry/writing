import type { ReactElement } from "react";
import { useRef, useState } from "react";

import type { BinderTree } from "../../binder/buildTree";
import type { SceneDocStore } from "../../db/sceneDocStore";
import { blobDownloadSave } from "./blobDownloadSave";
import { collectBlocks } from "./exportCollect";
import { toDocx, toMarkdown, toPdf } from "./exportFormatters";
import type { ExportData, ExportScope, SaveCallback } from "./types";

export interface ExportOverlayProps {
  projectId: string;
  scope: ExportScope;
  targetId: string;
  sceneDocStore: SceneDocStore;
  tree: BinderTree;
  onClose: () => void;
  onSave?: SaveCallback;
}

type ExportFormat = "markdown" | "docx" | "pdf";

const SCOPE_LABEL: Record<ExportScope, string> = {
  scene: "Scene",
  chapter: "Chapter",
  manuscript: "Whole manuscript",
};

const FORMAT_OPTIONS: { value: ExportFormat; label: string }[] = [
  { value: "markdown", label: "Markdown (.md)" },
  { value: "docx", label: "Word (.docx)" },
  { value: "pdf", label: "PDF" },
];

interface FormatResult { data: ExportData; mime: string; ext: string }

async function formatFor(f: ExportFormat, blocks: string[], title: string): Promise<FormatResult> {
  if (f === "docx") return { data: await toDocx(blocks, title), mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: "docx" };
  if (f === "pdf") return { data: await toPdf(blocks, title), mime: "application/pdf", ext: "pdf" };
  return { data: toMarkdown(blocks, title), mime: "text/markdown", ext: "md" };
}

interface ExecExportOpts {
  format: ExportFormat;
  scope: ExportScope;
  targetId: string;
  projectId: string;
  tree: BinderTree;
  store: SceneDocStore;
  save: SaveCallback;
}

async function execExport({ format, scope, targetId, projectId, tree, store, save }: ExecExportOpts): Promise<void> {
  const { blocks, suggestedTitle } = await collectBlocks(scope, targetId, tree, store);
  const title = suggestedTitle || projectId;
  const { data, mime, ext } = await formatFor(format, blocks, title);
  await save(`${title}.${ext}`, data, mime);
}

// ---------------------------------------------------------------------------
// FormatPicker
// ---------------------------------------------------------------------------

function FormatPicker({ format, onChange }: { format: ExportFormat; onChange: (f: ExportFormat) => void }): ReactElement {
  return (
    <fieldset style={{ border: "none", padding: 0, margin: 0 }} aria-label="Export format">
      <legend style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--ink-2)", marginBottom: 10 }}>
        Format
      </legend>
      {FORMAT_OPTIONS.map(({ value, label }) => (
        <label key={value} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 14, color: "var(--ink)", cursor: "pointer" }}>
          <input type="radio" name="export-format" value={value} checked={format === value} onChange={() => onChange(value)} />
          {label}
        </label>
      ))}
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// ExportSheet
// ---------------------------------------------------------------------------

interface ExportSheetProps {
  scope: ExportScope;
  format: ExportFormat;
  onFormatChange: (f: ExportFormat) => void;
  busy: boolean;
  errorMsg: string | null;
  onClose: () => void;
  onExport: () => void;
}

function ExportSheet({ scope, format, onFormatChange, busy, errorMsg, onClose, onExport }: ExportSheetProps): ReactElement {
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" style={{ width: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <div className="sheet-title">Export</div>
            <div className="sheet-sub">{SCOPE_LABEL[scope]}</div>
          </div>
          <button className="iconbtn sheet-x" type="button" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        <div className="sheet-body">
          <FormatPicker format={format} onChange={onFormatChange} />
          {errorMsg !== null && (
            <div role="alert" style={{ marginTop: 12, fontSize: 13, color: "var(--danger, #c0392b)" }}>
              {errorMsg}
            </div>
          )}
        </div>
        <div className="sheet-foot">
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" type="button" disabled={busy} onClick={onExport}>
              {busy ? "Generating…" : "Export"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ExportOverlay (public export)
// ---------------------------------------------------------------------------

export function ExportOverlay({ projectId, scope, targetId, sceneDocStore, tree, onClose, onSave }: ExportOverlayProps): ReactElement {
  const [format, setFormat] = useState<ExportFormat>("markdown");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const busyRef = useRef(false);

  function handleExport(): void {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setErrorMsg(null);
    execExport({ format, scope, targetId, projectId, tree, store: sceneDocStore, save: onSave ?? blobDownloadSave })
      .then(() => { onClose(); })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMsg(`Export failed: ${msg}`);
      })
      .finally(() => {
        busyRef.current = false;
        setBusy(false);
      });
  }

  return (
    <ExportSheet
      scope={scope} format={format} onFormatChange={setFormat}
      busy={busy} errorMsg={errorMsg} onClose={onClose} onExport={handleExport}
    />
  );
}
