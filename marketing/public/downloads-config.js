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
// macUrl: stable name on R2 — always points at the latest macOS release.
//   Upload target: r2://writersnook-downloads/WritersNook.dmg
//   (publish-mac.sh keeps this in sync on every release via wrangler r2 object put)
//   account.js / purchase-success.js wire #dl-mac / #succ-dl-mac from this;
//   site.js platform-detects the hero/pricing CTAs (macOS → macUrl).
// ============================================================================
window.WN_DL = {
  winUrl: "https://downloads.writersnook.app/WritersNook-Setup.exe",
  macUrl: "https://downloads.writersnook.app/WritersNook.dmg",
};
