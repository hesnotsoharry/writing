import { describe, expect, it } from "vitest";

import {
  type AiConversationStore,
  deriveConversationTitle,
  makeAiConversationStore,
} from "../db/aiConversationStore";
import { runMigrations } from "../db/migrations";
import type { DbHandle } from "../db/schema";
import { makeSqlJsDb } from "./support/sqljsDb";

// Orchestrator-authored Phase D acceptance test (Wave 35). The implementer
// implements `src/db/aiConversationStore.ts` against this contract and may NOT
// modify this file. The contract is the conversationStore boundary: persistence
// over SQLite (migration 16 ai_conversations + ai_messages), scoped listing,
// message round-trip, survives-restart, and cascade-free child delete (Decision 4).

const PROJECT = "proj-1";
const OTHER_PROJECT = "proj-2";

async function freshStore(): Promise<{ db: DbHandle & { close(): void }; store: AiConversationStore }> {
  const db = await makeSqlJsDb();
  await runMigrations(db);
  // The two projects the conversations reference must exist (FK target).
  await db.execute(
    "INSERT INTO projects (id, title, type, sort_order, created_at, updated_at) VALUES (?,?,?,?,?,?)",
    [PROJECT, "P1", "novel", 0, Date.now(), Date.now()],
  );
  await db.execute(
    "INSERT INTO projects (id, title, type, sort_order, created_at, updated_at) VALUES (?,?,?,?,?,?)",
    [OTHER_PROJECT, "P2", "novel", 1, Date.now(), Date.now()],
  );
  return { db, store: makeAiConversationStore(db) };
}

describe("aiConversationStore", () => {
  it("create + list round-trips a conversation scoped to its project", async () => {
    const { db, store } = await freshStore();
    try {
      const a = await store.createConversation(PROJECT, { title: "First", verb: "brainstorm" });
      await store.createConversation(OTHER_PROJECT, { title: "Elsewhere" });

      expect(a.id).toBeTruthy();
      expect(a.projectId).toBe(PROJECT);
      expect(a.title).toBe("First");
      expect(a.lastVerb).toBe("brainstorm");
      expect(typeof a.createdAt).toBe("number");
      expect(typeof a.updatedAt).toBe("number");

      const list = await store.listConversations(PROJECT);
      expect(list.map((c) => c.id)).toContain(a.id);
      // Scope: the other project's conversation must not leak in.
      expect(list.every((c) => c.projectId === PROJECT)).toBe(true);
    } finally {
      db.close();
    }
  });

  it("appendMessage persists role/verb/body/context_json/credits_cost; listMessages is ordered", async () => {
    const { db, store } = await freshStore();
    try {
      const conv = await store.createConversation(PROJECT, { title: "Thread" });
      const ctx = JSON.stringify({ sceneId: "s1", sceneTitle: "test1", entityNames: ["Maren"] });

      const you = await store.appendMessage(conv.id, {
        role: "you",
        verb: "brainstorm",
        body: "What does the potluck gift say?",
        contextJson: ctx,
        creditsCost: null,
      });
      const ai = await store.appendMessage(conv.id, {
        role: "ai",
        verb: "brainstorm",
        body: "It marks them as pragmatic.",
        contextJson: null,
        creditsCost: 3,
      });

      expect(you.id).toBeTruthy();
      expect(you.conversationId).toBe(conv.id);
      expect(ai.id).toBeTruthy();
      expect(ai.id).not.toBe(you.id);

      const msgs = await store.listMessages(conv.id);
      expect(msgs).toHaveLength(2);
      // Created order: you-message first, ai-message second.
      expect(msgs[0].role).toBe("you");
      expect(msgs[0].contextJson).toBe(ctx);
      expect(msgs[1].role).toBe("ai");
      expect(msgs[1].creditsCost).toBe(3);
      expect(msgs[1].contextJson).toBeNull();
    } finally {
      db.close();
    }
  });

  it("conversations persist across store instances on the same DB (survives restart)", async () => {
    const { db, store } = await freshStore();
    try {
      const conv = await store.createConversation(PROJECT, { title: "Persisted" });
      await store.appendMessage(conv.id, {
        role: "you",
        verb: "critique",
        body: "Look at the opening.",
        contextJson: null,
        creditsCost: null,
      });

      // A second store instance over the SAME db must read what the first wrote —
      // proves the store reads/writes SQLite, not in-memory component state.
      const reopened = makeAiConversationStore(db);
      const list = await reopened.listConversations(PROJECT);
      const found = list.find((c) => c.id === conv.id);
      expect(found).toBeDefined();
      expect(found?.title).toBe("Persisted");
      expect(await reopened.listMessages(conv.id)).toHaveLength(1);
    } finally {
      db.close();
    }
  });

  it("deleteConversation removes the conversation AND all its messages (no orphans)", async () => {
    const { db, store } = await freshStore();
    try {
      const conv = await store.createConversation(PROJECT, { title: "Doomed" });
      await store.appendMessage(conv.id, {
        role: "you",
        verb: "brainstorm",
        body: "msg one",
        contextJson: null,
        creditsCost: null,
      });
      await store.appendMessage(conv.id, {
        role: "ai",
        verb: "brainstorm",
        body: "msg two",
        contextJson: null,
        creditsCost: 2,
      });

      await store.deleteConversation(conv.id);

      expect(await store.listConversations(PROJECT)).toHaveLength(0);
      // Decision 4: child rows are explicitly deleted, not left to FK cascade.
      const orphans = await db.select<{ n: number }[]>(
        "SELECT COUNT(*) AS n FROM ai_messages WHERE conversation_id = ?",
        [conv.id],
      );
      expect(orphans[0].n).toBe(0);
    } finally {
      db.close();
    }
  });

  it("appendMessage bumps the conversation updated_at (monotonic, non-decreasing)", async () => {
    const { db, store } = await freshStore();
    try {
      const conv = await store.createConversation(PROJECT, { title: "Bumped" });
      const before = (await store.listConversations(PROJECT)).find((c) => c.id === conv.id)!;
      await store.appendMessage(conv.id, {
        role: "you",
        verb: "brainstorm",
        body: "tick",
        contextJson: null,
        creditsCost: null,
      });
      const after = (await store.listConversations(PROJECT)).find((c) => c.id === conv.id)!;
      expect(after.updatedAt).toBeGreaterThanOrEqual(before.updatedAt);
    } finally {
      db.close();
    }
  });
});

describe("deriveConversationTitle", () => {
  it("returns the full ask when 36 chars or fewer", () => {
    expect(deriveConversationTitle("Short question about Maren")).toBe("Short question about Maren");
  });

  it("truncates to 36 chars + ellipsis when longer", () => {
    const long = "What does the narrator's potluck contribution reveal about their worldview?";
    const out = deriveConversationTitle(long);
    expect(out.endsWith("…")).toBe(true);
    // 36 content chars + the ellipsis character.
    expect([...out].length).toBe(37);
    expect(out.startsWith("What does the narrator's potluck")).toBe(true);
  });

  it("trims surrounding whitespace before measuring", () => {
    expect(deriveConversationTitle("   hello   ")).toBe("hello");
  });
});
