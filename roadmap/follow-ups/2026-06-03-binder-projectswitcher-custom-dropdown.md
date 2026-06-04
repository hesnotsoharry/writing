---
status: OPEN
created: 2026-06-03
source: screen-port-batch
qualifying-criterion: multi-file
cannot-be-cleared-by: sonnet-implementer-dispatch
present-harm: K2 — the project switcher renders as a native `<select>` instead of the design's custom dropdown (`.proj-menu` / `.proj-item` / `.cm-backdrop` overlay structure). Verifiable at design-reference/binder.jsx (ProjectSwitch component) vs the wave-7 ProjectSwitcher.tsx which retains the plain `<select>` element (by design — wave-7 is a style-only lane, and this is a behavioral rewrite, not a style swap).
---

# Follow-up: binder-projectswitcher-custom-dropdown

The project switcher currently uses a native HTML `<select>` element. The design-reference shows a custom click-outside dropdown overlay (`.proj-menu` / `.proj-item` / `.cm-backdrop` structure with keyboard handling and custom styling).

Wave-7 deliberately deferred this because it is a behavioral rewrite (new state, keyboard handling, backdrop click-outside logic), not a style-swap. The native select works functionally; the custom dropdown is a design-polish item.

Wiring this requires:
1. A new `open` state in the ProjectSwitcher component.
2. A click-outside handler (backdrop) + keyboard (Escape) handling.
3. A custom dropdown menu UI rendering the list of projects.
4. Event handlers for project selection.

This is a multi-file, behavioral-change feature that cannot be cleared by a single sonnet-implementer dispatch (new state, new handlers, new markup).

## Design reference

`design-reference/binder.jsx` `ProjectSwitch()` component: the custom dropdown overlay with `.proj-menu`, `.proj-item`, `.proj-new` classes and click-outside behavior.

The CSS classes exist at `src/styles/app.css` lines 612–634 but are currently unused.

## Suggested resolution path

Polish wave owning "Binder/UI refinements" (custom dropdown + chapter collapse + twist chevron). Low risk; classes exist; can run after the screen-port batch stabilizes.
