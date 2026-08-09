import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import { runMigrations } from "../../db/migrations";
import { SqliteSyncLwwStore } from "../../db/sqliteSyncLwwStore";
import { LwwReconciler } from "../../sync/lww/reconciler";
import { LwwDomainRegistry } from "../../sync/lww/registry";
import { createLwwLocalBridges, registerLwwDomains } from "../../sync/lwwDomains";
import { isDiffMessage, isHelloMessage, isRowMessage, parseChannel, type RowMessage } from "../../sync/messages";
import { makeSqlJsDb } from "../support/sqljsDb";

const conversationPayload = { id: "c1", project_id: "p1", title: "Chat", last_verb: null,
  boundary_chapter_id: null, context_config: null, created_at: 1, updated_at: 1 };
const messagePayload = { id: "m1", conversation_id: "c1", role: "you", verb: "ask",
  body: "Private prompt", context_json: null, credits_cost: null, created_at: 2 };

function row(rowId: string, payload: Record<string, unknown>, hlc: string): RowMessage {
  return { t: "row", id: `ai_conversations:${rowId}`, domain: "ai_conversations",
    project: "p1", row: rowId, hlc, device: "phone", deleted: false,
    payload: JSON.stringify(payload) };
}

describe("AI conversation LWW domain", () => {
  it("holds an early message until its conversation is projected", async () => {
    const db = await makeSqlJsDb(); await runMigrations(db);
    const registry = new LwwDomainRegistry();
    registerLwwDomains(registry, db, { aiConversationsEnabled: true });
    try {
      const receiver = new LwwReconciler(new SqliteSyncLwwStore(db), registry, async () => undefined);
      await receiver.receiveRow(row("message:m1", messagePayload, "000000000000001-000000"));
      expect(await db.select("SELECT * FROM ai_messages")).toEqual([]);
      await receiver.receiveRow(row("conversation:c1", conversationPayload, "000000000000002-000000"));
      expect(await db.select<Array<{ body: string }>>("SELECT body FROM ai_messages"))
        .toEqual([{ body: "Private prompt" }]);
    } finally { db.close(); }
  });

  it("a conversation tombstone cascades to its messages", async () => {
    const db = await makeSqlJsDb(); await runMigrations(db);
    const registry = new LwwDomainRegistry();
    registerLwwDomains(registry, db, { aiConversationsEnabled: true });
    try {
      const receiver = new LwwReconciler(new SqliteSyncLwwStore(db), registry, async () => undefined);
      await receiver.receiveRow(row("conversation:c1", conversationPayload, "000000000000001-000000"));
      await receiver.receiveRow(row("message:m1", messagePayload, "000000000000002-000000"));
      await receiver.receiveRow({ ...row("conversation:c1", conversationPayload,
        "000000000000003-000000"), deleted: true, payload: null });
      expect(await db.select("SELECT * FROM ai_conversations")).toEqual([]);
      expect(await db.select("SELECT * FROM ai_messages")).toEqual([]);
    } finally { db.close(); }
  });

  it("defaults opt-in off, sends nothing, and ignores inbound AI rows", async () => {
    const db = await makeSqlJsDb(); await runMigrations(db);
    const registry = new LwwDomainRegistry();
    const registrations = registerLwwDomains(registry, db);
    const publish = vi.fn().mockResolvedValue(true);
    const bridges = createLwwLocalBridges(publish, registrations.aiConversationsEnabled);
    try {
      expect(registry.get("ai_conversations")).toBeNull();
      expect(await bridges.aiConversations.conversationSaved("p1", "c1")).toBe(false);
      expect(await bridges.aiConversations.messageAppended("p1", "m1")).toBe(false);
      expect(publish).not.toHaveBeenCalled();
      const receiver = new LwwReconciler(new SqliteSyncLwwStore(db), registry, async () => undefined);
      expect(await receiver.receiveRow(row("conversation:c1", conversationPayload,
        "000000000000001-000000"))).toBeNull();
      expect(await db.select("SELECT * FROM sync_lww_rows")).toEqual([]);
    } finally { db.close(); }
  });
});

describe("v1.2 compatibility", () => {
  it("drops row frames while scene and meta messages still converge unchanged", () => {
    const source = new Y.Doc(); source.getText("content").insert(0, "same prose");
    const scene = { t: "diff" as const, c: "scene:s1", u: Buffer.from(
      Y.encodeStateAsUpdate(source)).toString("base64") };
    const meta = { t: "diff" as const, c: "meta:p1", u: scene.u };
    const rowFrame = row("conversation:c1", conversationPayload, "000000000000001-000000");
    const legacyAccepts = (value: unknown) => isHelloMessage(value) || isDiffMessage(value);
    expect(legacyAccepts(rowFrame)).toBe(false);
    expect(isRowMessage(rowFrame)).toBe(true);
    expect([scene, meta].every(legacyAccepts)).toBe(true);
    expect(parseChannel(scene.c)).toEqual({ kind: "scene", id: "s1" });
    expect(parseChannel(meta.c)).toEqual({ kind: "meta", id: "p1" });
    const target = new Y.Doc();
    Y.applyUpdate(target, Buffer.from(scene.u, "base64"));
    expect(target.getText("content").toString()).toBe("same prose");
  });
});
