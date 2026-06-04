import type { ReactElement } from "react";

import type { AppView } from "../App.state";

/**
 * Phase 2 stub — wave-5 (app shell + custom window frame).
 *
 * Real implementation ports design-reference/chrome.jsx: brand, segmented
 * Write/Story-Bible view switch, centered doc name, action icons, and the
 * window controls (folded in from Phase 1's WindowControls). See
 * roadmap/wave-5-app-shell-custom-window-frame.md, Phase 2.
 *
 * The view-switch is the one behavioral surface — it is gated by the
 * orchestrator-owned oracle src/test/titleBar.viewSwitch.contract.test.tsx.
 * `view` + `onViewChange` are the required contract; presentational props
 * (doc name, action handlers) are added as optional fields by the implementer.
 */
export interface TitleBarProps {
  /** Current active view; drives which segment shows as active. */
  view: AppView;
  /** Called with the selected view when a segment is clicked. */
  onViewChange: (view: AppView) => void;
}

export function TitleBar(_props: TitleBarProps): ReactElement {
  return <div data-testid="titlebar-stub" />;
}
