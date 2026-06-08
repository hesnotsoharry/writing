import type { ReactElement } from "react";

import type { AppView } from "../App.state";
import darkLogo from "../assets/darklogo.png";
import lightLogo from "../assets/lightlogo.png";
import { Icon } from "../components/Icon";
import { WindowControls } from "./WindowControls";

export interface TitleBarProps {
  /** Current active view; drives which segment shows as active. */
  view: AppView;
  /** Called with the selected view when a segment is clicked. */
  onViewChange: (view: AppView) => void;
  /** Centered document / manuscript name. Omit to hide. */
  docName?: string;
  /** Whether the Goals panel is open (tints the target icon). */
  goalsOn?: boolean;
  /** Whether the Quick Capture popover has pending items (shows dot badge). */
  hasQuickItems?: boolean;
  /** Whether Find & Replace is open (tints the search icon). */
  showFindReplace?: boolean;
  /** Whether Version History is open (tints the rotate icon). */
  showHistory?: boolean;
  /** Whether Quick Capture is open (tints the zap icon; .has-dot badge is independent). */
  showQuickCapture?: boolean;
  /** Whether Focus Mode is active (tints the focus icon). */
  focusMode?: boolean;
  /** Whether Settings is open (tints the cog icon). */
  showSettings?: boolean;
  /** Handler for the Goals icon button. */
  onToggleGoals?: () => void;
  /** Handler for the Quick Capture icon button. */
  onOpenQuick?: () => void;
  /** Handler for the Focus Mode icon button. */
  onEnterFocus?: () => void;
  /** Handler for the Settings icon button. */
  onOpenSettings?: () => void;
  /** Handler for the Export button. */
  onOpenExport?: () => void;
  /** Handler for the Find & Replace button in the title bar. */
  onOpenFind?: () => void;
  /** Handler for the Version History button. Omit when no scene is selected. */
  onOpenHistory?: () => void;
}

/** Segmented Write / Corkboard / Story Bible view switch. */
function ViewSwitch({ view, onViewChange }: Pick<TitleBarProps, "view" | "onViewChange">): ReactElement {
  // Both "cork" and "outline" are sub-modes of the planning area; the Corkboard
  // button activates for both, and clicking it navigates to "cork" (the default).
  const inPlanningArea = view === "cork" || view === "outline";
  // "entry" is a story-bible drill-down; both views keep the Story Bible button lit.
  const inBibleArea = view === "bible" || view === "entry";
  return (
    <div className="segmented">
      <button
        className={view === "editor" ? "on" : ""}
        aria-pressed={view === "editor"}
        onClick={() => { onViewChange("editor"); }}
      >
        <Icon name="type" className="ic" style={view === "editor" ? { color: "var(--accent)" } : undefined} />
        {" Write"}
      </button>
      <button
        className={inPlanningArea ? "on" : ""}
        aria-pressed={inPlanningArea}
        onClick={() => { onViewChange("cork"); }}
      >
        <Icon name="grid" className="ic" style={inPlanningArea ? { color: "var(--accent)" } : undefined} />
        {" Corkboard"}
      </button>
      <button
        className={inBibleArea ? "on" : ""}
        aria-pressed={inBibleArea}
        onClick={() => { onViewChange("bible"); }}
      >
        <Icon name="book" className="ic" style={inBibleArea ? { color: "var(--accent)" } : undefined} />
        {" Story Bible"}
      </button>
    </div>
  );
}

/** Right-hand action icon buttons + Export pill. */
function TitleBarActions({
  goalsOn, hasQuickItems, showFindReplace, showHistory, showQuickCapture, focusMode, showSettings,
  onToggleGoals, onOpenQuick, onEnterFocus, onOpenSettings, onOpenExport, onOpenFind, onOpenHistory,
}: Required<Pick<TitleBarProps, "goalsOn" | "hasQuickItems" | "onToggleGoals" | "onOpenQuick" | "onEnterFocus" | "onOpenSettings" | "onOpenExport" | "onOpenFind">>
  & Pick<TitleBarProps, "onOpenHistory" | "showFindReplace" | "showHistory" | "showQuickCapture" | "focusMode" | "showSettings">): ReactElement {
  const accent = { color: "var(--accent)" };
  return (
    <div className="tb-actions">
      <button className="iconbtn" title="Find &amp; replace  ⌘F" aria-label="Find and replace" onClick={onOpenFind}>
        <Icon name="search" className="ic" style={showFindReplace ? accent : undefined} />
      </button>
      {onOpenHistory && (
        <button className="iconbtn" title="Version history" aria-label="Version history" onClick={onOpenHistory}>
          <Icon name="rotate" className="ic" style={showHistory ? accent : undefined} />
        </button>
      )}
      <button className="iconbtn" title="Goals" aria-label="Goals" onClick={onToggleGoals}>
        <Icon name="target" className="ic" style={goalsOn ? accent : undefined} />
      </button>
      <button
        className={"iconbtn" + (hasQuickItems ? " has-dot" : "")}
        title="Quick capture  ⌘K" aria-label="Quick capture" onClick={onOpenQuick}
      >
        <Icon name="zap" className="ic" style={showQuickCapture ? accent : undefined} />
      </button>
      <button className="iconbtn" title="Focus mode  ⌘." aria-label="Focus mode" onMouseDown={(e) => { e.preventDefault(); }} onClick={onEnterFocus}>
        <Icon name="focus" className="ic" style={focusMode ? accent : undefined} />
      </button>
      <button className="iconbtn" title="Settings  ⌘," aria-label="Settings" onClick={onOpenSettings}>
        <Icon name="cog" className="ic" style={showSettings ? accent : undefined} />
      </button>
      <button className="btn btn-soft" style={{ marginLeft: 4 }} aria-label="Export" onClick={onOpenExport}>
        <Icon name="download" className="ic" />{" Export"}
      </button>
    </div>
  );
}

/**
 * Full designed title bar: brand · divider · view-switch · doc-name · actions ·
 * divider · window controls.
 *
 * The segmented view-switch satisfies src/test/titleBar.viewSwitch.contract.test.tsx:
 * Write → onViewChange("editor"), Corkboard → onViewChange("cork"),
 * Story Bible → onViewChange("bible"), aria-pressed tracks view.
 * Action handlers are wired in App.tsx (wave-11).
 */
export function TitleBar({
  view, onViewChange, docName, goalsOn = false, hasQuickItems = false,
  showFindReplace, showHistory, showQuickCapture, focusMode, showSettings,
  onToggleGoals, onOpenQuick, onEnterFocus, onOpenSettings, onOpenExport, onOpenFind, onOpenHistory,
}: TitleBarProps): ReactElement {
  return (
    <div className="titlebar" data-tauri-drag-region>
      <div className="brand">
        {/* Theme-aware logo — replaces the former feather + "Writers Nook" wordmark. */}
        <img className="logo-light" src={lightLogo} alt="Writers Nook" />
        <img className="logo-dark" src={darkLogo} alt="Writers Nook" />
      </div>
      <div className="tb-divider" />
      <ViewSwitch view={view} onViewChange={onViewChange} />
      {docName !== undefined && (
        <div className="doc-name">
          {docName}
          {/* TODO(wave-N): live save-state indicator — wire to the Yjs
              bind-persistence onSaved signal. No fabricated "saved" text. */}
        </div>
      )}
      <TitleBarActions
        goalsOn={goalsOn} hasQuickItems={hasQuickItems}
        showFindReplace={showFindReplace} showHistory={showHistory}
        showQuickCapture={showQuickCapture} focusMode={focusMode} showSettings={showSettings}
        onToggleGoals={onToggleGoals ?? (() => {})}
        onOpenQuick={onOpenQuick ?? (() => {})}
        onEnterFocus={onEnterFocus ?? (() => {})}
        onOpenSettings={onOpenSettings ?? (() => {})}
        onOpenExport={onOpenExport ?? (() => {})}
        onOpenFind={onOpenFind ?? (() => {})}
        onOpenHistory={onOpenHistory}
      />
      <div className="tb-divider" />
      <div className="wbtns">
        <WindowControls />
      </div>
    </div>
  );
}
