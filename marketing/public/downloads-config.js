/* global window */
// ============================================================================
// Download URL configuration — PUBLIC installer artifact URLs.
// Loaded via a plain <script> tag BEFORE account.js so window.WN_DL is
// available when account.js wires the download buttons.
//
// winUrl: stable name on R2 — always points at the latest Windows release.
//   Upload target: r2://writersnook-downloads/WritersNook-Setup.exe
//   (publish.ps1 keeps this in sync on every release via wrangler r2 object put)
//
// macUrl: omitted intentionally — no macOS build exists yet.
//   account.js / purchase-success.js guard with `if (mac && cfg.macUrl)` so the
//   Mac buttons stay at href="#" and render as disabled (m-btn-coming-soon).
// ============================================================================
window.WN_DL = {
  winUrl: "https://downloads.writersnook.app/WritersNook-Setup.exe",
};
