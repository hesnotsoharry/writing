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
}

export function AppShell({
  titleBar, binder, viewStage, inspector, statusBar,
}: AppShellProps): ReactElement {
  return (
    <div className="win">
      {titleBar}
      <div className="body">
        <div className="panel-binder">{binder}</div>
        <div className="center">
          <div className="view-stage">{viewStage}</div>
        </div>
        <div className="panel-inspector">{inspector}</div>
      </div>
      {statusBar}
    </div>
  );
}
