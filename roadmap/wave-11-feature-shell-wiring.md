---
status: SHIPPED
shipped: 2026-06-04
commits: a8fe7aa..d01bc4f
---
# Wave 11: feature-shell-wiring

Result: SERIAL wiring-wave bottleneck for the parallel feature batch. Stamped every mount point and
built zero feature UI — AppView += "cork"; 9 overlay/focus state flags+setters in useAppState; 5
TitleBar triggers; 6 flag-gated overlay stubs + Corkboard view stub; global keybindings (⌘K/⌘./⌘E/⌘,,
Esc); focus mode fully done (data-focus on .win + chrome recedes + exit affordance); migration 4
(quick_notes/goals/archive, project_id NOT NULL); BinderCallbacks archive stubs; Settings theme-setter
contract; setGoalsOn/setHasQuickItems threaded to overlay props. 169/169 tests, tsc+lint clean,
mechanical /review PASS, wave-end adversarial review PASS (1 FLAG fixed in d01bc4f). ⚠ Live Tauri smoke
pending (no runtime in build session) — see HANDOFF Next-Step 1.
Promoted: [0007-grammar-harper-core-ipc](../decisions/0007-grammar-harper-core-ipc.md)
Vendor-gotchas updated: none
