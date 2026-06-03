---
status: SHIPPED
shipped: 2026-06-03
commits: abcf330..7c06158
---
# Wave 4: design-system foundation

Result: Committed the design-reference canon; adopted tokens.css + app.css verbatim into `src/styles/` with a global import in main.tsx; self-hosted the 5 design fonts via static @fontsource; ported the Icon set (46), the menu primitives (ContextMenu/Toast/RenameInput), and a slim useTheme hook to typed TSX. Purely additive — no existing screen touched; primitives are consumed starting in the wave-5 shell. Full suite 105/105; lint + tsc clean. Mechanical review FLAG (foundation-wave dead exports — justified) + wave-end adversarial review FLAG (ContextMenu icon prop tightened to IconName) both addressed.

Promoted: [0002-window-frame](decisions/0002-window-frame-recorded-for-next-wave.md) · [0003-tokens-verbatim](decisions/0003-tokens-css-app-css-adopted-verbatim.md) · [0004-dnd-kit-regraft](decisions/0004-drag-re-grafted-onto-designed-binder-recorded.md) · [0005-css-only-animations](decisions/0005-animations-are-css-only.md)
Vendor-gotchas updated: [fontsource](../.claude/vendor-gotchas/fontsource.md)
Research sidecar: [wave-4-…-research.md](wave-4-design-system-foundation-research.md)

⚠ Live `tauri dev` smoke PENDING (Cole): parchment background + Literata/Hanken Grotesk fonts load, no Google Fonts request, all four existing screens still render + respond.
