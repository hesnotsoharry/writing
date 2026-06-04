---
status: OPEN
created: 2026-06-03
source: wave-5
qualifying-criterion: multi-file
cannot-be-cleared-by: sonnet-implementer-dispatch
present-harm: K3 — the design's "Quiet Study" floating look (inset/rounded/shadow over the desktop) is not present in the square-frameless ship; restored with transparency.
---

# Follow-up: Transparent/floating window aesthetic

## Context

Wave 5 shipped the square-frameless custom window frame with `decorations:false`, deliberately deferring the transparent/floating rounded-shadow aesthetic to avoid WebView2 render risk on Windows. The design calls for a cream-colored frame with inset shadow, floating above the desktop.

## Issue

The transparent aesthetic requires:
1. Setting `transparent:true` in `src-tauri/tauri.conf.json` (currently absent)
2. Un-commenting the `.win @media (min-width:1180px)` floating block in `src/styles/app.css` (disabled in wave-5; it exposes the opaque `#cfc6b4` body as a cream frame without transparency)
3. Windows-specific render verification (WebView2 transparency handling; inset shadow paints correctly)

Currently, the app renders with a square opaque frame. The deferred step restores the design intent.

## Why this is a follow-up

This requires Windows-specific render validation beyond the scope of the Phase 4 shell-frame ship. Transparency carries known WebView2 quirks (see wave-5 research §4); the square-frameless baseline was proven first.

## Suggested approach

- [ ] Set `app.windows[0].transparent: true` in `tauri.conf.json`
- [ ] Un-comment the `.win` floating CSS block in `src/styles/app.css`
- [ ] Run `npm run tauri dev` on Windows 11 Pro; verify: (a) the frame is translucent, (b) the desktop shows through the rounded corners, (c) the inset shadow renders without artifacts
- [ ] If render issues surface, consult the wave-5 research sidecar (§4) for workarounds or fall back to a semi-transparent `rgba(207, 198, 180, 0.98)` opacity

---

*Filed from wave-5 follow-up candidates; deferred to avoid Windows WebView2 transparency risk during the functional shell ship.*
