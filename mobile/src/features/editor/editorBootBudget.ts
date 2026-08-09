/**
 * How long the editor is allowed to take before it gives up and falls back to
 * the read-only reader.
 *
 * These used to reuse `MOBILE_LIVE_SCENE_ACK_TIMEOUT_MS` (5 s), which is named
 * for — and correctly sized for — a *bridge ACK round-trip*: a small message
 * over an already-running WebView channel. Booting the editor is a different
 * order of magnitude: the WebView parses a ~1.8 MB single-file HTML document
 * with three inlined font binaries, starts React, and boots ProseMirror/TipTap
 * before it can answer the handshake.
 *
 * On the emulator that consistently exceeded 5 s, so every scene opened
 * read-only with "Couldn't load the editor". Nothing was actually broken — the
 * asset resolved in under 100 ms and the port never rejected. The app was
 * simply being timed against the wrong stopwatch, and the failure was silent
 * and total: a writing app that will not let you write.
 *
 * The two budgets are separated so that tightening ACK latency can never again
 * shorten the boot budget as a side effect.
 */

/** Fetching the bundled asset URI. Local file resolution — fast or broken. */
export const EDITOR_ASSET_TIMEOUT_MS = 15_000;

/**
 * WebView parse + React mount + ProseMirror boot + handshake. Generous on
 * purpose: a slow cold start should make the writer wait a moment, never
 * silently drop them into a read-only view of their own manuscript.
 */
export const EDITOR_BOOT_TIMEOUT_MS = 30_000;

/**
 * Injected into the WebView before its content loads, so a JS error inside the
 * editor bundle reaches the host instead of vanishing. Without it the only
 * symptom is that the handshake never completes and the writer is dropped into
 * a read-only view of their own scene with no reason given.
 *
 * Messages are tagged `__editor-diag` so the host can log and discard them
 * without them ever reaching the bridge protocol parser.
 */
export const EDITOR_ERROR_FORWARDER = `
  (function () {
    function send(payload) {
      if (!window.ReactNativeWebView) return;
      window.ReactNativeWebView.postMessage(JSON.stringify(
        Object.assign({ type: "__editor-diag" }, payload)));
    }
    window.onerror = function (message, source, line, column) {
      send({ message: String(message), source: String(source), line: line, column: column });
      return false;
    };
    window.addEventListener("unhandledrejection", function (event) {
      var reason = event.reason;
      send({ message: "unhandledrejection: " + String(reason && reason.stack ? reason.stack : reason) });
    });
  })();
  true;
`;

/** Tag on forwarded WebView diagnostics; never a bridge-protocol message. */
export const EDITOR_DIAG_TAG = "__editor-diag";
