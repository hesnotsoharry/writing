---
status: SHIPPED
shipped: 2026-06-10
commits: 755388b..c9b93dc
---
# Wave 31: relationship-map-overhaul
Result: Ported Claude Design "Direction B / Cartographer's key" relationship map to production — six-type color/icon system (entityTypeDefs.ts), run-once FR layout (frLayout.ts, d3-force removed from this component only), key card with ResizeObserver exclusion zone, fixed hover-focus (neighbours stay lit), empty state, footer hint; relation-chip type colors in FullEntry; customTypes threaded through map props. Mechanical review PASS; CDP-smoke-verified both themes, 5 types, narrow pane, empty state.
Deferred in-plan: EgoGraph restyle (RETIRED same-day post-wrap, commit 0e8762a); customTypes in RelationshipGroup chips.
