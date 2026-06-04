import { describe, expect, it } from "vitest";

import { InMemoryBinderStore, type SceneStatus } from "../db/binderStore";
import { runMigrations } from "../db/migrations";
import { makeSqlJsDb } from "./support/sqljsDb";

/**
 * Orchestrator-owned acceptance test for Wave 12 Phase 1 (scene status data layer).
 *
 * Expresses the boundary contract from the consumer's perspective:
 *  - migration 5 adds a `status` column to `scenes`, defaulting to 'blank',
 *    and is idempotent (the no-try/catch crash-recovery runner may re-run it);
 *  - the BinderStore round-trips scene status via `setSceneStatus`.
 *
 * The implementer makes this pass and MUST NOT modify this file.
 */

async function tableColumns(
  db: Awaited<ReturnType<typeof makeSqlJsDb>>,
  table: string
): Promise<{ name: string; dflt_value: string | null }[]> {
  return db.select<{ name: string; dflt_value: string | null }[]>(
    `PRAGMA table_info('${table}')`
  );
}

describe("Wave 12 — scene status data layer (acceptance)", () => {
  it("migration adds a 'status' column to scenes defaulting to 'blank'", async () => {
    const db = await makeSqlJsDb();
    try {
      await runMigrations(db);

      const cols = await tableColumns(db, "scenes");
      const status = cols.find((c) => c.name === "status");
      expect(status, "scenes.status column should exist").toBeDefined();

      // A scene inserted without specifying status takes the 'blank' default.
      await db.execute(
        "INSERT INTO scenes (id, project_id, title, sort_order) VALUES ($1, $2, $3, $4)",
        ["sc-accept-1", "p-accept", "Untitled", 1000]
      );
      const rows = await db.select<{ status: string }[]>(
        "SELECT status FROM scenes WHERE id = $1",
        ["sc-accept-1"]
      );
      expect(rows[0].status).toBe("blank");
    } finally {
      db.close();
    }
  });

  it("migration is idempotent — re-running does not throw 'duplicate column'", async () => {
    const db = await makeSqlJsDb();
    try {
      await runMigrations(db);
      // Second run simulates a crash-recovery re-entry. The ADD COLUMN guard
      // must make this a no-op rather than a 'duplicate column name' throw.
      await expect(runMigrations(db)).resolves.not.toThrow();

      const cols = await tableColumns(db, "scenes");
      const statusCols = cols.filter((c) => c.name === "status");
      expect(statusCols).toHaveLength(1);
    } finally {
      db.close();
    }
  });

  it("BinderStore round-trips scene status; new scenes default to 'blank'", async () => {
    const store = new InMemoryBinderStore();
    const projectId = await store.createProject({
      title: "Salt Road",
      type: "novel",
    });
    const sceneId = await store.createScene({
      projectId,
      folderId: null,
      title: "Opening",
    });

    // New scene defaults to 'blank'.
    const before = await store.loadProject(projectId);
    expect(before.scenes[0].status).toBe("blank");

    // setSceneStatus persists the new value, observed via loadProject.
    const next: SceneStatus = "done";
    await store.setSceneStatus(sceneId, next);

    const after = await store.loadProject(projectId);
    expect(after.scenes[0].status).toBe("done");
  });
});
