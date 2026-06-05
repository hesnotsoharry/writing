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
}

/** Segmented Write / Corkboard / Story Bible view switch. */
function ViewSwitch({ view, onViewChange }: Pick<TitleBarProps, "view" | "onViewChange">): ReactElement {
  // Both "cork" and "outline" are sub-modes of the planning area; the Corkboard
  // button activates for both, and clicking it navigates to "cork" (the default).
  const inPlanningArea = view === "cork" || view === "outline";
  return (
    <div className="segmented">
      <button
        className={view === "editor" ? "on" : ""}
        aria-pressed={view === "editor"}
        onClick={() => { onViewChange("editor"); }}
      >
        <Icon name="type" className="ic" />
        {" Write"}
      </button>
      <button
        className={inPlanningArea ? "on" : ""}
        aria-pressed={inPlanningArea}
        onClick={() => { onViewChange("cork"); }}
      >
        <Icon name="grid" className="ic" />
        {" Corkboard"}
      </button>
      <button
        className={view === "bible" ? "on" : ""}
        aria-pressed={view === "bible"}
        onClick={() => { onViewChange("bible"); }}
      >
        <Icon name="book" className="ic" />
        {" Story Bible"}
      </button>
    </div>
  );
}

/** Right-hand action icon buttons + Export pill. */
function TitleBarActions({
  goalsOn, hasQuickItems, onToggleGoals, onOpenQuick, onEnterFocus, onOpenSettings, onOpenExport,
}: Required<Pick<TitleBarProps, "goalsOn" | "hasQuickItems" | "onToggleGoals" | "onOpenQuick" | "onEnterFocus" | "onOpenSettings" | "onOpenExport">>): ReactElement {
  return (
    <div className="tb-actions">
      <button className="iconbtn" title="Goals" aria-label="Goals" onClick={onToggleGoals}>
        <Icon name="target" className="ic" style={goalsOn ? { color: "var(--accent)" } : undefined} />
      </button>
      <button
        className={"iconbtn" + (hasQuickItems ? " has-dot" : "")}
        title="Quick capture  ⌘K" aria-label="Quick capture" onClick={onOpenQuick}
      >
        <Icon name="zap" className="ic" />
      </button>
      <button className="iconbtn" title="Focus mode  ⌘." aria-label="Focus mode" onClick={onEnterFocus}>
        <Icon name="focus" className="ic" />
      </button>
      <button className="iconbtn" title="Settings  ⌘," aria-label="Settings" onClick={onOpenSettings}>
        <Icon name="cog" className="ic" />
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
  view, onViewChange, docName,
  goalsOn = false, hasQuickItems = false,
  onToggleGoals, onOpenQuick, onEnterFocus, onOpenSettings, onOpenExport,
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
        goalsOn={goalsOn}
        hasQuickItems={hasQuickItems}
        onToggleGoals={onToggleGoals ?? (() => {})}
        onOpenQuick={onOpenQuick ?? (() => {})}
        onEnterFocus={onEnterFocus ?? (() => {})}
        onOpenSettings={onOpenSettings ?? (() => {})}
        onOpenExport={onOpenExport ?? (() => {})}
      />
      <div className="tb-divider" />
      <div className="wbtns">
        <WindowControls />
      </div>
    </div>
  );
}
