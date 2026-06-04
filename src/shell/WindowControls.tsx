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
    <div style={{ display: "flex", gap: 2 }}>
      {/* Using canon .wbtn CSS class so hover states (including .wbtn.close:hover
          clay treatment) are driven by app.css rather than inline styles. */}
      <button className="wbtn" aria-label="Minimize"
        onClick={() => { void getCurrentWindow().minimize(); }}>
        <Icon name="minus" style={{ width: 14, height: 14 }} />
      </button>
      <button className="wbtn" aria-label="Maximize"
        onClick={() => { void getCurrentWindow().toggleMaximize(); }}>
        <Icon name="square" style={{ width: 12, height: 12 }} />
      </button>
      <button className="wbtn close" aria-label="Close"
        onClick={() => { void getCurrentWindow().close(); }}>
        <Icon name="x" style={{ width: 13, height: 13 }} />
      </button>
    </div>
  );
}
