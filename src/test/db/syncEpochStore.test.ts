import { describe, expect, it, vi } from "vitest";

import type { DbClient } from "../../db/dbClient";
import { readAppliedEpochs, writeAppliedEpochs } from "../../db/syncEpochStore";

function mockDb(value: string): DbClient {
  return {
    select: vi.fn(() => Promise.resolve([{ value }])),
    execute: vi.fn(() => Promise.resolve({ rowsAffected: 1 })),
  };
}

describe("applied epoch persistence", () => {
  it("normalizes legacy numeric entries to wildcard-owned stamps", async () => {
    await expect(readAppliedEpochs(mockDb(JSON.stringify({ s1: 3 }))))
      .resolves.toEqual({ s1: { n: 3, d: "" } });
  });

  it("round-trips owned stamps as JSON without a schema migration", async () => {
    const db = mockDb("{}");
    await writeAppliedEpochs(db, { s1: { n: 4, d: "device-a" } });
    expect(db.execute).toHaveBeenCalledWith(
      "INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)",
      ["sync_applied_epochs", JSON.stringify({ s1: { n: 4, d: "device-a" } })]
    );
  });
});
