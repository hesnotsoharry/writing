import { getCurrentWindow } from "@tauri-apps/api/window";
import type { ReactElement } from "react";

import { Icon } from "../components/Icon";

/**
 * Custom window controls — minimize / maximize-restore / close.
 *
 * Wired to Tauri 2's window API (`@tauri-apps/api/window`).
 * Requires capabilities: core:window:allow-minimize,
 * core:window:allow-toggle-maximize, core:window:allow-close.
 *
 * Rendered inside a `data-tauri-drag-region` parent so buttons still
 * receive clicks despite the drag region.
 */
export function WindowControls(): ReactElement {
  // Resolve the window handle lazily (inside click handlers) rather than at
  // render time — avoids a crash when `window.__TAURI_INTERNALS__` is absent
  // (jsdom test environment, hot-reload before Tauri context is ready).
  return (
    <div style={{ display: "flex", gap: 4 }}>
      <button
        aria-label="Minimize"
        onClick={() => { void getCurrentWindow().minimize(); }}
        style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 6px", lineHeight: 0 }}
      >
        <Icon name="minus" style={{ width: 14, height: 14 }} />
      </button>
      <button
        aria-label="Maximize"
        onClick={() => { void getCurrentWindow().toggleMaximize(); }}
        style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 6px", lineHeight: 0 }}
      >
        <Icon name="square" style={{ width: 14, height: 14 }} />
      </button>
      <button
        aria-label="Close"
        onClick={() => { void getCurrentWindow().close(); }}
        style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 6px", lineHeight: 0 }}
      >
        <Icon name="x" style={{ width: 14, height: 14 }} />
      </button>
    </div>
  );
}
