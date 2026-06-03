---
status: SHIPPED
shipped: 2026-06-03
commits: 36eb547..dce8890
---
# Wave 3: scene-notes

Result: Story Bible (character/location CRUD view) + auto-detect scene-notes inspector. Added `plaintext_projection` + `characters`/`locations`/`scene_links` schema, a pure `detectEntities` matcher (longest-first regex, alias/possessive/metachar-safe), a detection-sync service with per-scene write serialization, the Story Bible CRUD view, and a reactive right-panel inspector. Detection runs on scene save + on entity mutation. Full suite 82/82; tsc + lint clean. **Live `tauri dev` smoke of the inspector reactivity is still pending (not runnable from the build session).**

Promoted: [auto-detect-entity-scene-linking](../decisions/auto-detect-entity-scene-linking.md), [scene-prose-lives-in-a-y-xmlfragment](../decisions/scene-prose-lives-in-a-y-xmlfragment.md)
Vendor-gotchas updated: [tiptap](../../.claude/vendor-gotchas/tiptap.md)
Follow-ups filed: [app-detection-wiring-coverage](follow-ups/2026-06-03-app-detection-wiring-coverage.md)
