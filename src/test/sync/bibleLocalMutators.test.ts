import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runMigrations } from "../../db/migrations";
import { DbProjectDomainDocStore } from "../../db/projectDomainDocStore";
import { SqliteStoryBibleStore } from "../../db/sqliteStoryBibleStore";
import { applyBibleDoc } from "../../sync/bible/bibleApplyExec";
import { buildBibleFromSql } from "../../sync/bible/bibleDoc";
import { BibleLocalBridge } from "../../sync/bible/bibleLocalBridge";
import { DbBibleApplyTarget } from "../../sync/bible/dbBibleApplyTarget";
import { encodeDoc } from "../../yjs/serialize";
import { makeSqlJsDb, type SqlJsTestDb } from "../support/sqljsDb";

let db: SqlJsTestDb;

async function seedProject(): Promise<void> {
  await db.execute(
    "INSERT INTO projects (id,title,type,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?)",
    ["p1", "Project", "novel", 1000, "now", "now"],
  );
  await db.execute(
    "INSERT INTO scenes (id,project_id,folder_id,title,sort_order,word_count,status) VALUES (?,?,?,?,?,?,?)",
    ["s1", "p1", null, "Scene", 1000, 0, "draft"],
  );
}

beforeEach(async () => {
  db = await makeSqlJsDb(); await runMigrations(db); await seedProject();
});
afterEach(() => db.close());

describe("desktop Bible local-write bridge", () => {
  it("notifies once for every local mutator unit", async () => {
    const docs = new DbProjectDomainDocStore(db); const bridge = new BibleLocalBridge(docs);
    await docs.save("bible", "p1", encodeDoc(buildBibleFromSql({
      entities: [], entityTypes: [], fields: [], sceneLinks: [], entityLinks: [], relations: [],
    })));
    const listener = vi.fn(); bridge.subscribe(listener);
    const store = new SqliteStoryBibleStore({ bridge, db });
    const character = await store.createCharacter("p1", "Ada", null);
    const location = await store.createLocation("p1", "Hall", null);
    const item = await store.createEntity("p1", "item", "Key", null);
    const custom = await store.createCustomType({ projectId: "p1", name: "Creature", icon: "paw", color: "moss" });
    await store.renameEntity("character", character.id, "Ada Lovelace");
    await store.updateEntityNotes("character", character.id, "Notes");
    await store.setEntityExclusion("character", character.id, true);
    const field = await store.addEntityField(character.id, "fact", "Age");
    await store.setEntityField(character.id, "fact", "Age", "36");
    await store.updateEntityFieldKey(field.id, "Years");
    await store.reorderEntityFields([{ id: field.id, sort: 2 }]);
    const link = await store.addLink(character.id, item.id, "carries");
    await store.updateLinkRelation(link.id, "owns"); await store.removeLink(link.id);
    await store.replaceSceneLinks("s1", [{ entityType: "character", entityId: character.id }]);
    const relation = await store.addRelation("p1", {
      fromEntity: character.id, toEntity: location.id, label: "Visits", reciprocalLabel: "Hosts",
    });
    await store.updateRelationLabel(relation.id, "Enters"); await store.deleteRelation(relation.id);
    await store.deleteEntityField(field.id); await store.deleteCustomType(custom.id);
    await store.deleteEntity("item", item.id);
    expect(listener).toHaveBeenCalledTimes(21);
  });

  it("does not notify when a remote Bible doc is projected through the raw target", async () => {
    const docs = new DbProjectDomainDocStore(db); const bridge = new BibleLocalBridge(docs);
    const listener = vi.fn(); bridge.subscribe(listener);
    const remote = buildBibleFromSql({
      entities: [{ id: "remote", projectId: "p1", storage: "character",
        entityType: "character", name: "Remote", notes: null, aliases: null, excludeFromAi: false }],
      entityTypes: [], fields: [], sceneLinks: [], entityLinks: [], relations: [],
    });
    await applyBibleDoc("p1", remote, new DbBibleApplyTarget(db));
    expect(listener).not.toHaveBeenCalled();
  });

  it("leaves an unpaired user SQL-only", async () => {
    const docs = new DbProjectDomainDocStore(db); const bridge = new BibleLocalBridge(docs);
    const listener = vi.fn(); bridge.subscribe(listener);
    const store = new SqliteStoryBibleStore({ bridge, db });
    const character = await store.createCharacter("p1", "Offline", null);
    expect((await db.select<Array<{ name: string }>>(
      "SELECT name FROM characters WHERE id = ?", [character.id],
    ))[0]?.name).toBe("Offline");
    expect(await docs.load("bible", "p1")).toBeNull();
    expect(listener).not.toHaveBeenCalled();
  });
});
