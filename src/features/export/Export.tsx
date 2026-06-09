import type { ReactElement } from "react";
import { useRef, useState } from "react";

import type { BinderTree } from "../../binder/buildTree";
import { Icon, type IconName } from "../../components/Icon";
import type { SceneDocStore } from "../../db/sceneDocStore";
import { blobDownloadSave } from "./blobDownloadSave";
import { collectBlocks } from "./exportCollect";
import { toDocx, toMarkdown, toPdf } from "./exportFormatters";
import type { ExportData, ExportScope, SaveCallback } from "./types";

export interface ExportOverlayProps {
  projectId: string;
  /** Scope shown when the overlay first opens; the user can change it. */
  initialScope: ExportScope;
  /** ID of the currently-selected scene (null if none). */
  sceneId: string | null;
  /** Parent chapter folder ID of the selected scene (null for short pieces / no active scene). */
  chapterId: string | null;
  /** Project/manuscript title used as the Manuscript scope label. */
  projectTitle?: string;
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

const FORMAT_OPTIONS: { value: ExportFormat; label: string; icon: IconName; name: string; desc: string }[] = [
  { value: "markdown", label: "Markdown (.md)", icon: "hash",     name: "Markdown", desc: ".md"   },
  { value: "docx",     label: "Word (.docx)",   icon: "fileText", name: "Word",     desc: ".docx" },
  { value: "pdf",      label: "PDF",            icon: "fileText", name: "PDF",      desc: "print-ready" },
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

/** Resolves which ID to pass to collectBlocks based on the selected scope. */
function resolveTargetId(scope: ExportScope, sceneId: string | null, chapterId: string | null, projectId: string): string {
  if (scope === "scene") return sceneId ?? "";
  if (scope === "chapter") return chapterId ?? "";
  return projectId;
}

/**
 * Clamps initialScope to one the current context can satisfy.
 * Falls back: "scene" requires sceneId; "chapter" requires chapterId;
 * "manuscript" is always valid. If the requested scope's target is absent,
 * prefer "chapter" (when available), else "manuscript".
 */
function resolveInitialScope(
  initialScope: ExportScope, sceneId: string | null, chapterId: string | null,
): ExportScope {
  if (initialScope === "scene" && sceneId !== null) return "scene";
  if (initialScope === "chapter" && chapterId !== null) return "chapter";
  if (initialScope === "manuscript") return "manuscript";
  return chapterId !== null ? "chapter" : "manuscript";
}

/** Returns the ordered scope options that have a valid target in the current context. */
function scopeOptions(hasScene: boolean, hasChapter: boolean): ExportScope[] {
  const opts: ExportScope[] = [];
  if (hasScene) opts.push("scene");
  if (hasChapter) opts.push("chapter");
  opts.push("manuscript");
  return opts;
}

async function execExport({ format, scope, targetId, projectId, tree, store, save }: ExecExportOpts): Promise<void> {
  const { blocks, suggestedTitle } = await collectBlocks(scope, targetId, tree, store);
  if (blocks.length === 0) throw new Error("Nothing to export — the selection contains no content.");
  const title = suggestedTitle || projectId;
  const { data, mime, ext } = await formatFor(format, blocks, title);
  await save(`${title}.${ext}`, data, mime);
}

// ---------------------------------------------------------------------------
// FormatPicker
// ---------------------------------------------------------------------------

function FormatPicker({ format, onChange }: { format: ExportFormat; onChange: (f: ExportFormat) => void }): ReactElement {
  function handleKeyDown(e: React.KeyboardEvent, idx: number): void {
    let next = -1;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (idx + 1) % FORMAT_OPTIONS.length;
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = (idx - 1 + FORMAT_OPTIONS.length) % FORMAT_OPTIONS.length;
    if (next !== -1) {
      e.preventDefault();
      onChange(FORMAT_OPTIONS[next].value);
    }
  }

  return (
    <div role="radiogroup" aria-label="Export format">
      <label className="field-label">Format</label>
      <div className="fmt-grid">
        {FORMAT_OPTIONS.map(({ value, label, icon, name, desc }, idx) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={format === value}
            aria-label={label}
            className={"fmt" + (format === value ? " on" : "")}
            onClick={() => onChange(value)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
          >
            <span className="fmt-ic">
              <Icon name={icon} style={{ width: 16, height: 16 }} />
            </span>
            <span>
              <div className="fmt-name">{name}</div>
              <div className="fmt-desc">{desc}</div>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ScopePicker
// ---------------------------------------------------------------------------

function scopeDesc(
  value: ExportScope,
  sceneTitle: string | null,
  chapterTitle: string | null,
  projectTitle: string | null
): string {
  if (value === "scene") return sceneTitle ?? "Current scene";
  if (value === "chapter") return chapterTitle ?? "Current chapter";
  return projectTitle ?? "Whole manuscript";
}

interface ScopePickerProps {
  scope: ExportScope;
  hasScene: boolean;
  hasChapter: boolean;
  sceneTitle: string | null;
  chapterTitle: string | null;
  projectTitle: string | null;
  onChange: (s: ExportScope) => void;
}

function ScopePicker({ scope, hasScene, hasChapter, sceneTitle, chapterTitle, projectTitle, onChange }: ScopePickerProps): ReactElement {
  const options = scopeOptions(hasScene, hasChapter);
  return (
    <div role="radiogroup" aria-label="Export scope" style={{ marginBottom: 16 }}>
      <label className="field-label">Scope</label>
      <div className="fmt-grid">
        {options.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={scope === value}
            className={"fmt" + (scope === value ? " on" : "")}
            onClick={() => onChange(value)}
          >
            <span>
              <div className="fmt-name">{SCOPE_LABEL[value]}</div>
              <div className="fmt-desc">{scopeDesc(value, sceneTitle, chapterTitle, projectTitle)}</div>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ExportSheet
// ---------------------------------------------------------------------------

interface ExportSheetProps {
  scope: ExportScope;
  onScopeChange: (s: ExportScope) => void;
  hasScene: boolean;
  hasChapter: boolean;
  sceneTitle: string | null;
  chapterTitle: string | null;
  projectTitle: string | null;
  format: ExportFormat;
  onFormatChange: (f: ExportFormat) => void;
  busy: boolean;
  errorMsg: string | null;
  onClose: () => void;
  onExport: () => void;
}

function ExportSheet({
  scope, onScopeChange, hasScene, hasChapter, sceneTitle, chapterTitle, projectTitle,
  format, onFormatChange, busy, errorMsg, onClose, onExport,
}: ExportSheetProps): ReactElement {
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" style={{ width: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <div className="sheet-title"><Icon name="download" className="ic" />Export</div>
            <div className="sheet-sub">{SCOPE_LABEL[scope]}</div>
          </div>
          <button className="iconbtn sheet-x" type="button" aria-label="Close" onClick={onClose}><Icon name="x" className="ic" /></button>
        </div>
        <div className="sheet-body">
          <ScopePicker scope={scope} hasScene={hasScene} hasChapter={hasChapter}
            sceneTitle={sceneTitle} chapterTitle={chapterTitle} projectTitle={projectTitle} onChange={onScopeChange} />
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

export function ExportOverlay({
  projectId, initialScope, sceneId, chapterId, projectTitle, sceneDocStore, tree, onClose, onSave,
}: ExportOverlayProps): ReactElement {
  const [scope, setScope] = useState<ExportScope>(() => resolveInitialScope(initialScope, sceneId, chapterId));
  const [format, setFormat] = useState<ExportFormat>("markdown");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const busyRef = useRef(false);
  const allScenes = [...tree.chapters.flatMap((c) => c.scenes), ...tree.shortPieces];
  const activeScene = sceneId ? allScenes.find((s) => s.id === sceneId) : null;
  const activeChapter = chapterId ? tree.chapters.find((c) => c.folder.id === chapterId) : null;
  const targetId = resolveTargetId(scope, sceneId, chapterId, projectId);

  function handleExport(): void {
    if (busyRef.current) return;
    if (!targetId) { setErrorMsg("Nothing to export for the selected scope."); return; }
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
      scope={scope} onScopeChange={setScope} format={format} onFormatChange={setFormat}
      hasScene={sceneId !== null} hasChapter={chapterId !== null} sceneTitle={activeScene?.title ?? null}
      chapterTitle={activeChapter?.folder.title ?? null} projectTitle={projectTitle ?? null}
      busy={busy} errorMsg={errorMsg} onClose={onClose} onExport={handleExport}
    />
  );
}
