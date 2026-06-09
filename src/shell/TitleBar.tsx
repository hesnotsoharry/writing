import type { MouseEvent, ReactElement } from "react";
import { useEffect, useRef, useState } from "react";

import type { AppView } from "../App.state";
import darkLogo from "../assets/darklogo.png";
import lightLogo from "../assets/lightlogo.png";
import { Icon } from "../components/Icon";
import type { MenuDescriptor, MenuItem } from "../components/menu/ContextMenu";
import { ContextMenu } from "../components/menu/ContextMenu";
import { WindowControls } from "./WindowControls";

// ── Types ──────────────────────────────────────────────────────────────────

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

/**
 * Shared prop shape for TitleBarActions and CollapsedActionsBar.
 * Required handlers are normalised to noops in makeActionBarProps.
 */
type ActionBarProps = Required<Pick<TitleBarProps,
  | "goalsOn" | "hasQuickItems"
  | "onToggleGoals" | "onOpenQuick" | "onEnterFocus"
  | "onOpenSettings" | "onOpenExport" | "onOpenFind"
>> & Pick<TitleBarProps,
  | "onOpenHistory" | "showFindReplace" | "showHistory"
  | "showQuickCapture" | "focusMode" | "showSettings"
>;

// ── Constants ──────────────────────────────────────────────────────────────

const noop = () => {};

/**
 * Collapse action icons into an overflow menu below this titlebar pixel-width.
 * Estimated from: brand(≈38) + view-switch(≈300) + full-actions(≈310) +
 * wbtns(94) + gaps/padding(≈50) ≈ 792px; threshold is set ~30px below that.
 * Adjust visually if the transition point looks off at the target screen size.
 */
const ACTIONS_COLLAPSE_WIDTH = 760;

// ── Helpers ────────────────────────────────────────────────────────────────

/** Normalise optional handlers to noops and apply boolean defaults. */
function makeActionBarProps({
  goalsOn, hasQuickItems,
  showFindReplace, showHistory, showQuickCapture, focusMode, showSettings,
  onToggleGoals, onOpenQuick, onEnterFocus, onOpenSettings, onOpenExport, onOpenFind, onOpenHistory,
}: TitleBarProps): ActionBarProps {
  return {
    goalsOn: goalsOn ?? false,
    hasQuickItems: hasQuickItems ?? false,
    showFindReplace, showHistory, showQuickCapture, focusMode, showSettings,
    onToggleGoals: onToggleGoals ?? noop,
    onOpenQuick: onOpenQuick ?? noop,
    onEnterFocus: onEnterFocus ?? noop,
    onOpenSettings: onOpenSettings ?? noop,
    onOpenExport: onOpenExport ?? noop,
    onOpenFind: onOpenFind ?? noop,
    onOpenHistory,
  };
}

/** Build the MenuItem array that populates the overflow "⋯" dropdown. */
function buildOverflowMenuItems(p: ActionBarProps): MenuItem[] {
  const a = "var(--accent)";
  const out: MenuItem[] = [
    { label: "Find & Replace", icon: "search", iconColor: p.showFindReplace ? a : undefined, onClick: p.onOpenFind },
    { label: "Goals",          icon: "target", iconColor: p.goalsOn          ? a : undefined, onClick: p.onToggleGoals },
    { label: "Quick Capture",  icon: "zap",    iconColor: p.showQuickCapture ? a : undefined, onClick: p.onOpenQuick },
    { label: "Focus Mode",     icon: "focus",  iconColor: p.focusMode        ? a : undefined, onClick: p.onEnterFocus },
    { label: "Settings",       icon: "cog",    iconColor: p.showSettings     ? a : undefined, onClick: p.onOpenSettings },
    { type: "sep" as const },
    { label: "Export",         icon: "download", onClick: p.onOpenExport },
  ];
  if (p.onOpenHistory) {
    out.splice(1, 0, {
      label: "Version History", icon: "rotate",
      iconColor: p.showHistory ? a : undefined, onClick: p.onOpenHistory,
    });
  }
  return out;
}

/**
 * Returns true when the observed titlebar element is narrower than the collapse
 * threshold. Uses ResizeObserver so the value tracks live window resizes.
 * Initial value is false (full actions); the observer fires after first paint.
 */
function useTitleBarCollapsed(ref: { current: HTMLDivElement | null }): boolean {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setCollapsed((entry?.contentRect.width ?? 0) < ACTIONS_COLLAPSE_WIDTH);
    });
    ro.observe(el);
    return () => { ro.disconnect(); };
  }, [ref]);
  return collapsed;
}

// ── Sub-components ─────────────────────────────────────────────────────────

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

/** Right-hand action icon buttons + Export pill (full-width mode). */
function TitleBarActions({
  goalsOn, hasQuickItems, showFindReplace, showHistory, showQuickCapture, focusMode, showSettings,
  onToggleGoals, onOpenQuick, onEnterFocus, onOpenSettings, onOpenExport, onOpenFind, onOpenHistory,
}: ActionBarProps): ReactElement {
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
 * Collapsed state: single "⋯" overflow button that opens a ContextMenu listing
 * all actions with their labels. Reuses the existing ContextMenu primitive for
 * positioning, keyboard dismiss, and viewport-edge correction.
 */
function CollapsedActionsBar(p: ActionBarProps): ReactElement {
  const [menu, setMenu] = useState<MenuDescriptor | null>(null);
  const open = (e: MouseEvent<HTMLButtonElement>) => {
    const { left: x, bottom } = e.currentTarget.getBoundingClientRect();
    setMenu({ x, y: bottom + 4, items: buildOverflowMenuItems(p) });
  };
  return (
    <div className="tb-actions">
      <button className="iconbtn" title="Actions" aria-label="Actions menu" onClick={open}>
        <Icon name="moreH" className="ic" />
      </button>
      <ContextMenu menu={menu} onClose={() => { setMenu(null); }} />
    </div>
  );
}

// ── TitleBar ───────────────────────────────────────────────────────────────

/**
 * Full designed title bar: brand · divider · view-switch · doc-name · actions ·
 * divider · window controls.
 *
 * The segmented view-switch satisfies src/test/titleBar.viewSwitch.contract.test.tsx:
 * Write → onViewChange("editor"), Corkboard → onViewChange("cork"),
 * Story Bible → onViewChange("bible"), aria-pressed tracks view.
 * Action handlers are wired in App.tsx (wave-11).
 *
 * Responsive behaviour: below ACTIONS_COLLAPSE_WIDTH the icon bar collapses into
 * a single "⋯" overflow button that opens a labelled ContextMenu. The window
 * controls (.wbtns) are anchored in the right half of a flex:1 left-group
 * so they are never pushed off-screen regardless of window width.
 */
export function TitleBar(props: TitleBarProps): ReactElement {
  const { view, onViewChange, docName } = props;
  const barRef = useRef<HTMLDivElement>(null);
  const collapsed = useTitleBarCollapsed(barRef);
  const ap = makeActionBarProps(props);
  return (
    <div className="titlebar" ref={barRef} data-tauri-drag-region>
      <div className="tb-left">
        <div className="brand">
          {/* Theme-aware logo — replaces the former feather + "Writers Nook" wordmark. */}
          <img className="logo-light" src={lightLogo} alt="Writers Nook" />
          <img className="logo-dark" src={darkLogo} alt="Writers Nook" />
        </div>
        <div className="tb-divider" />
        <ViewSwitch view={view} onViewChange={onViewChange} />
      </div>
      {docName !== undefined && <div className="doc-name">{docName}</div>}
      {collapsed ? <CollapsedActionsBar {...ap} /> : <TitleBarActions {...ap} />}
      <div className="tb-divider" />
      <div className="wbtns"><WindowControls /></div>
    </div>
  );
}
