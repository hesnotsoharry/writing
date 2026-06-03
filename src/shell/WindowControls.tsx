import type { ReactElement } from "react";

/**
 * Phase 1 stub — wave-5 (app shell + custom window frame).
 *
 * Real implementation wires minimize / maximize-restore / close buttons to
 * `getCurrentWindow()` from `@tauri-apps/api/window`. See
 * roadmap/wave-5-app-shell-custom-window-frame.md, Phase 1.
 *
 * This stub renders a placeholder so the orchestrator-owned oracle test
 * (src/test/windowControls.contract.test.tsx) compiles and fails on the
 * missing controls (not on a setup error) before the implementer fills it in.
 */
export function WindowControls(): ReactElement {
  return <div data-testid="window-controls-stub" />;
}
