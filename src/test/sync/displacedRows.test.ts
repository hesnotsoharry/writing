import { describe, expect, it, vi } from "vitest";

import {
displacedNotePayload,
type DisplacedRow,   DisplacedRowKeeper, } from "../../sync/lww/displacedRows";
import type { LwwDomainAdapter } from "../../sync/lww/registry";
import { LwwDomainRegistry } from "../../sync/lww/registry";

const AT = 1_756_000_000_000;

function row(overrides: Partial<DisplacedRow> = {}): DisplacedRow {
  return {
    domain: "quick_notes", rowId: "note-1", projectId: "project-1",
    payloadJson: JSON.stringify({ id: "note-1", project_id: "project-1", body: "my version" }),
    winnerDevice: "device-b", ...overrides,
  };
}

describe("displacedNotePayload", () => {
  it("keeps a quick note's body as an inbox note under a new id", () => {
    const payload = displacedNotePayload(row(), "note-new", AT);
    expect(payload).not.toBeNull();
    expect(JSON.parse(payload!)).toEqual({
      id: "note-new", project_id: "project-1", body: "my version", created_at: AT,
      filed: 0, source: "Replaced by another device", state: "inbox",
    });
  });

  it("flattens an About page into labelled sections, skipping empty ones", () => {
    const payload = displacedNotePayload(row({
      domain: "manuscript_about",
      payloadJson: JSON.stringify({
        project_id: "project-1", synopsis: "A ferryman", genre: "", tone: "  ",
        pov: "First", notes: "",
      }),
    }), "note-new", AT);
    expect(JSON.parse(payload!).body).toBe("Synopsis: A ferryman\n\nPOV: First");
  });

  it("keeps nothing for domains where last-writer-wins is the right answer", () => {
    for (const domain of ["goals", "archive", "scene_snapshots", "boards", "ai_conversations"]) {
      expect(displacedNotePayload(row({ domain }), "note-new", AT)).toBeNull();
    }
  });

  it("keeps nothing when the losing version was empty or unreadable", () => {
    expect(displacedNotePayload(row({ payloadJson: "not json" }), "n", AT)).toBeNull();
    expect(displacedNotePayload(row({ payloadJson: "[1,2]" }), "n", AT)).toBeNull();
    expect(displacedNotePayload(row({
      payloadJson: JSON.stringify({ body: "   " }),
    }), "n", AT)).toBeNull();
    expect(displacedNotePayload(row({
      domain: "manuscript_about", payloadJson: JSON.stringify({ synopsis: "" }),
    }), "n", AT)).toBeNull();
  });
});

function makeKeeper(overrides: Partial<LwwDomainAdapter> = {}) {
  const written: Array<{ rowId: string; projectId: string | null; payloadJson: string }> = [];
  const published: unknown[] = [];
  const registry = new LwwDomainRegistry();
  registry.register({
    domain: "quick_notes",
    readPayload: () => Promise.resolve(null),
    projectReceived: (rowId, projectId, payloadJson) => {
      written.push({ rowId, projectId, payloadJson });
      return Promise.resolve();
    },
    applyTombstone: () => Promise.resolve(),
    ...overrides,
  });
  const keeper = new DisplacedRowKeeper({
    registry,
    publish: (mutation) => { published.push(mutation); return Promise.resolve(true); },
    newId: () => "note-new", now: () => AT,
  });
  return { keeper, published, written };
}

describe("DisplacedRowKeeper", () => {
  it("writes the losing version to the inbox and publishes it to peers", async () => {
    const { keeper, published, written } = makeKeeper();
    expect(await keeper.keep(row())).toBe(true);
    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({ rowId: "note-new", projectId: "project-1" });
    // Published too: the preserved copy must survive on every device, not only
    // on the one that happened to lose.
    expect(published).toEqual([
      { domain: "quick_notes", projectId: "project-1", rowId: "note-new", deleted: false },
    ]);
  });

  it("does nothing for a domain that is not preserved", async () => {
    const { keeper, published, written } = makeKeeper();
    expect(await keeper.keep(row({ domain: "goals" }))).toBe(false);
    expect(written).toEqual([]);
    expect(published).toEqual([]);
  });

  it("swallows a write failure rather than failing the apply of the winner", async () => {
    // Losing the preserved copy is bad; leaving the two devices divergent
    // because the winning row never applied is worse.
    const { keeper } = makeKeeper({
      projectReceived: () => Promise.reject(new Error("disk full")),
    });
    await expect(keeper.keep(row())).resolves.toBe(false);
  });

  it("does nothing when the quick-notes domain is not registered", async () => {
    const keeper = new DisplacedRowKeeper({
      registry: new LwwDomainRegistry(), publish: vi.fn(),
      newId: () => "note-new", now: () => AT,
    });
    expect(await keeper.keep(row())).toBe(false);
  });
});
