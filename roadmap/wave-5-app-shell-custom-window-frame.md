---
status: SHIPPED
shipped: 2026-06-03
commits: 6ebb708..a8c04c9
---
# Wave 5: app shell + custom window frame

Result: Frameless window (`decorations:false`, square-frameless) + custom window controls + ported TitleBar/StatusBar + `AppShell` three-pane layout with stable named slots + `useTheme()` at root. Floating/transparent aesthetic deferred. 4 phases, 122 tests green, wave-end adversarial review + `/review` PASS, smoke-confirmed (incl. cream-frame fix).
Promoted: none — core decision pre-existing as [0002](../decisions/0002-window-frame-recorded-for-next-wave.md) (implemented this wave).
Vendor-gotchas updated: [tauri.md](../../.claude/vendor-gotchas/tauri.md)
Follow-ups filed: [transparent-window-aesthetic](follow-ups/2026-06-03-transparent-window-aesthetic.md) · [screen-inline-style-shedding](follow-ups/2026-06-03-screen-inline-style-shedding.md) · [statusbar-live-data-wiring](follow-ups/2026-06-03-statusbar-live-data-wiring.md)
