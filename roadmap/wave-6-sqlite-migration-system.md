---
status: SHIPPED
shipped: 2026-06-03
commits: 8bb5b86..dac71ed
merged: 2569146
---
# Wave 6: SQLite versioned migration system

Result: `PRAGMA user_version` migration framework (`src/db/migrations.ts`, run from `getDb()`) — M1 frozen baseline, M2 folds `plaintext_projection`, M3 rebuilds the `scene_links` UNIQUE table with row dedup. Built in a parallel session; joint-wrap `/review` Checks 1/2/3 PASS, Check-5 commit-hygiene FLAG resolved (acceptance test confirmed authored test-first). **Live migration smoke PASSED on real `writing.db` 2026-06-03** — binder tree intact, Story Bible links persist, no data loss. 144/144 combined tests green.
Promoted: [0006-sqlite-migration-framework](../decisions/0006-sqlite-migration-framework.md)
Vendor-gotchas updated: [tauri-plugin-sql.md](../../.claude/vendor-gotchas/tauri-plugin-sql.md)
Follow-ups filed: none
