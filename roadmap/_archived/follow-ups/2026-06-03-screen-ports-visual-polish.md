---
status: RESOLVED
resolved-during: followups-ui-batch
created: 2026-06-03
updated: 2026-06-13
source: screen-port-batch
qualifying-criterion: multi-file
cannot-be-cleared-by: sonnet-implementer-dispatch
present-harm: K1 — smoke 2026-06-03 observed ~15–25% visual gap across ported screens vs design-reference: Story Bible "Add character/location" button readability inside `.add-entity` wrapper, padding/alignment micro-adjustments, and minor color/spacing tweaks in the canvas and inspector panes. Verifiable by comparing `npm run tauri dev` rendered screens against design-reference/*.jsx mockups side-by-side.
---

# Follow-up: screen-ports-visual-polish

Post-batch integration smoke (2026-06-03) uncovered minor visual gaps between the ported screens and the design-reference mockups:

- **Story Bible**: `.add-entity` button styling (text color, flex layout) makes the "Add character" / "Add location" button less readable than in the reference.
- **Canvas / Editor**: minor padding/margin tweaks needed to match reference prose measure and margins precisely.
- **Inspector**: card spacing, avatar sizing, and role-subtitle text color adjustments.
- **Binder**: minor section spacing and project-switcher alignment polish.

These are not functional bugs — the screens work and are mostly correct — but are cosmetic refinements to achieve pixel-perfect design parity.

## Scope

~15–25% visual gap across all ported screens. The gaps are primarily in:
1. Color/contrast within interactive affordances (add buttons, empty states).
2. Spacing/padding micro-adjustments (margins, gaps, line heights).
3. Typography sizing/weight in edge cases (subtitles, labels).

## Why deferred

These were discovered during integration smoke and require:
1. A live `tauri dev` session to compare rendered output side-by-side with mockups.
2. Incremental adjustments to CSS (which may require minor app.css additions post-freeze, or localized token-var tweaks).
3. Cross-screen coordination to ensure consistency (e.g., `.add-entity` button styling is consistent across Binder / Story Bible / Inspector).

A single sonnet-implementer dispatch cannot coordinate all four screens' polish in one shot without live visual feedback.

## Suggested resolution path

Polish wave running AFTER the screen-port batch is fully merged and integrated. Lead runs a single `tauri dev` session comparing each screen to the design-reference, documents the gaps, then dispatches a single "visual polish pass" implementer or coordinates incremental CSS tweaks. Recommend batching with other post-merge visual-refinement work.

## Resolution (2026-06-13)

Closed by orchestrator mechanical audit on 2026-06-13.
Evidence: Gaps closed by the waves 18–31 feature rework; 2026-06-13 CDP smoke (Story Bible + Corkboard + editor at width) found no residual visual gaps worth actioning.
