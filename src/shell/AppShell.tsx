import type { ReactElement, ReactNode } from "react";

/**
 * AppShell — stable three-pane layout shell.
 *
 * Structure (mirrors design-reference/shell.jsx):
 *   .win > {titleBar} + .body[ .panel-binder | .center > .view-stage | .panel-inspector ] + {statusBar}
 *
 * AppShell is DUMB — it renders whatever slot content it receives into named
 * regions. App() owns all view→screen routing. This keeps the shell stable:
 * future screen-port waves change what App() passes, never this component.
 *
 * Panel wrapper elision: when `binder` or `inspector` is null the corresponding
 * .panel-binder / .panel-inspector wrapper div is NOT rendered at all, so the
 * .center column is truly full-bleed. Passing null is the correct signal for
 * full-bleed views (cork / bible / entry / focus mode).
 *
 * Extension point — Corkboard: when App() gains a `view === "cork"` branch,
 * the Corkboard element is passed as `viewStage`. This component is not changed.
 * See roadmap/wave-5-app-shell-custom-window-frame.md, Phase 3.
 *
 * The slot→region contract is pinned by the orchestrator-owned oracle
 * src/test/appShell.slots.contract.test.tsx.
 */
export interface AppShellProps {
  /** Title bar region (top of .win, sibling of .body — not inside it). */
  titleBar: ReactNode;
  /** Left panel — .panel-binder. */
  binder: ReactNode;
  /** Center stage — .center > .view-stage. The active screen, chosen by App(). */
  viewStage: ReactNode;
  /** Right panel — .panel-inspector. May be null (App() decides visibility). */
  inspector: ReactNode;
  /** Status bar region (bottom of .win, sibling of .body — not inside it). */
  statusBar: ReactNode;
  /** When true, stamps data-focus on the root .win div (CSS extension point). */
  focusMode?: boolean;
  /**
   * When true, adds the `.anim` class to the root `.win` element, enabling the
   * canon motion animations (view-in fade-up, bar-in selected indicator, etc.).
   * Gated on the motion tweak; `.anim`-gated CSS rules also require
   * `@media (prefers-reduced-motion: no-preference)` so reduced-motion is
   * always honoured even when this is true.
   */
  anim?: boolean;
  /**
   * React key for the `.view-stage` wrapper. When this changes React remounts
   * the wrapper, restarting the `.anim .view-stage` CSS entrance animation.
   * Pass the current view string (e.g. "editor" | "cork" | "bible").
   */
  viewKey?: string;
}

export function AppShell({
  titleBar, binder, viewStage, inspector, statusBar, focusMode, anim, viewKey,
}: AppShellProps): ReactElement {
  const winClass = ["win", anim ? "anim" : ""].filter(Boolean).join(" ");
  return (
    <div className={winClass} data-focus={focusMode || undefined}>
      {titleBar}
      <div className="body">
        {binder != null && <div className="panel-binder">{binder}</div>}
        <div className="center">
          <div className="view-stage" key={viewKey}>{viewStage}</div>
        </div>
        {inspector != null && <div className="panel-inspector">{inspector}</div>}
      </div>
      {statusBar}
    </div>
  );
}
