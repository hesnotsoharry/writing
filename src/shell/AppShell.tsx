import type { ReactElement, ReactNode } from "react";

/**
 * Phase 3 stub — wave-5 (app shell + custom window frame).
 *
 * Real implementation ports design-reference/shell.jsx into the stable layout:
 *   .win > {titleBar} + .body[ .panel-binder | .center > .view-stage | .panel-inspector ] + {statusBar}
 *
 * AppShell is a DUMB layout — it renders whatever slot content it is handed into
 * the named regions. App() owns the view→screen routing (which screen is the
 * viewStage, whether the inspector shows). This is what keeps the slots stable:
 * a later screen-port wave changes what App() passes, never AppShell's wiring.
 *
 * The slot→region contract is pinned by the orchestrator-owned oracle
 * src/test/appShell.slots.contract.test.tsx. See
 * roadmap/wave-5-app-shell-custom-window-frame.md, Phase 3.
 */
export interface AppShellProps {
  /** Title bar region (top of .win). */
  titleBar: ReactNode;
  /** Left panel — .panel-binder. */
  binder: ReactNode;
  /** Center stage — .center > .view-stage. The active screen, chosen by App(). */
  viewStage: ReactNode;
  /** Right panel — .panel-inspector. May be null (App() decides visibility). */
  inspector: ReactNode;
  /** Status bar region (bottom of .win). */
  statusBar: ReactNode;
}

export function AppShell(props: AppShellProps): ReactElement {
  void props;
  return <div data-testid="appshell-stub" />;
}
