// @vitest-environment jsdom
/**
 * Sync → UI event bridge (Problem A). Verifies the dispatch seam directly:
 * a remote LWW row apply (sqlDomain.ts) fires SYNC_ROWS_APPLIED_EVENT plus
 * the domain alias, a remote meta-doc apply (SqliteMetaApplyTarget) fires
 * PROJECTS_CHANGED_EVENT, and a remote bible-doc apply (SqliteBibleApplyTarget)
 * fires BIBLE_CHANGED_EVENT. Runs under jsdom (unlike most sync tests, which
 * run under node) specifically because the dispatch is a `typeof window`-gated
 * no-op there — this file is what proves the gate opens when a window exists.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runMigrations } from "../../db/migrations";
import { getDb } from "../../db/schema";
import { SqliteBibleApplyTarget } from "../../db/sqliteBibleApplyTarget";
import { SqliteMetaApplyTarget } from "../../db/sqliteMetaApplyTarget";
import { GOALS_CHANGED_EVENT, QUICK_NOTES_CHANGED_EVENT } from "../../lib/settings";
import { createSqlDomainAdapter, type SqlDomainDefinition } from "../../sync/lwwDomains/sqlDomain";
import { applyMetaDoc } from "../../sync/meta/applyExec";
import { buildFromSql } from "../../sync/meta/metaDoc";
import { BIBLE_CHANGED_EVENT, PROJECTS_CHANGED_EVENT, SYNC_ROWS_APPLIED_EVENT } from "../../sync/syncEvents";
import { makeSqlJsDb, type SqlJsTestDb } from "../support/sqljsDb";

vi.mock("../../db/schema", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../db/schema")>();
  return { ...actual, getDb: vi.fn() };
});

let db: SqlJsTestDb;

beforeEach(async () => {
  db = await makeSqlJsDb();
  await runMigrations(db);
  vi.mocked(getDb).mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);
});

afterEach(() => {
  db.close();
  vi.clearAllMocks();
});

const GOALS_DEFINITION: SqlDomainDefinition = {
  domain: "goals", table: "goals", key: "id",
  columns: ["id", "project_id", "goal_type", "target", "enabled", "created_at", "config_json", "updated_at"],
};

const BOARDS_DEFINITION: SqlDomainDefinition = {
  domain: "boards", table: "boards", key: "id", columns: ["id", "project_id", "title", "sort"],
};

function listen(eventName: string): { calls: Event[] } {
  const state = { calls: [] as Event[] };
  window.addEventListener(eventName, (e) => state.calls.push(e));
  return state;
}

describe("sqlDomain.ts — row-domain applies dispatch SYNC_ROWS_APPLIED_EVENT", () => {
  it("projectReceived fires the generic event with the domain in detail, plus the goals alias", async () => {
    const adapter = createSqlDomainAdapter(db, GOALS_DEFINITION);
    const generic = listen(SYNC_ROWS_APPLIED_EVENT);
    const alias = listen(GOALS_CHANGED_EVENT);

    await adapter.projectReceived("g1", "p1", JSON.stringify({
      id: "g1", project_id: "p1", goal_type: "daily", target: 500,
      enabled: 1, created_at: 1, config_json: "{}", updated_at: null,
    }));

    expect(generic.calls).toHaveLength(1);
    expect((generic.calls[0] as CustomEvent).detail).toEqual({ domain: "goals" });
    expect(alias.calls).toHaveLength(1);
  });

  it("applyTombstone fires the generic event with the domain in detail, plus the quick_notes alias", async () => {
    const definition: SqlDomainDefinition = {
      domain: "quick_notes", table: "quick_notes", key: "id",
      columns: ["id", "project_id", "body", "created_at", "filed", "source", "state"],
    };
    const adapter = createSqlDomainAdapter(db, definition);
    const generic = listen(SYNC_ROWS_APPLIED_EVENT);
    const alias = listen(QUICK_NOTES_CHANGED_EVENT);

    await adapter.applyTombstone("n1", "p1");

    expect(generic.calls).toHaveLength(1);
    expect((generic.calls[0] as CustomEvent).detail).toEqual({ domain: "quick_notes" });
    expect(alias.calls).toHaveLength(1);
  });

  it("a domain with no dedicated alias (boards) fires only the generic event", async () => {
    const adapter = createSqlDomainAdapter(db, BOARDS_DEFINITION);
    const generic = listen(SYNC_ROWS_APPLIED_EVENT);

    await adapter.projectReceived("b1", "p1", JSON.stringify({ id: "b1", project_id: "p1", title: "Plot", sort: 0 }));

    expect(generic.calls).toHaveLength(1);
    expect((generic.calls[0] as CustomEvent).detail).toEqual({ domain: "boards" });
  });
});

describe("SqliteMetaApplyTarget — remote meta-doc applies dispatch PROJECTS_CHANGED_EVENT", () => {
  it("fires once for ensureProject and once per folder/scene upsert", async () => {
    const events = listen(PROJECTS_CHANGED_EVENT);
    const doc = buildFromSql({
      project: { id: "remote-project", title: "Remote Novel", type: "novel" },
      folders: [{ id: "f1", project_id: "remote-project", title: "Act One", sort_order: 1000 }],
      scenes: [{
        id: "s1", project_id: "remote-project", folder_id: "f1", title: "Scene One",
        synopsis: null, sort_order: 1000, status: "draft",
      }],
      labels: [], sceneLabels: [],
    });
    await applyMetaDoc("remote-project", doc, new SqliteMetaApplyTarget());

    // ensureProject + upsertFolder + upsertScene = 3.
    expect(events.calls.length).toBeGreaterThanOrEqual(3);
  });
});

describe("SqliteBibleApplyTarget — remote bible-doc applies dispatch BIBLE_CHANGED_EVENT", () => {
  it("fires on upsertEntity", async () => {
    const events = listen(BIBLE_CHANGED_EVENT);
    const target = new SqliteBibleApplyTarget();
    await target.upsertEntity({
      id: "e1", projectId: "p1", storage: "character", entityType: "character",
      name: "Sarah", notes: null, aliases: null, excludeFromAi: false,
    });

    expect(events.calls.length).toBeGreaterThanOrEqual(1);
  });
});
