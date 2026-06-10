// Wave 30 Phase 2 — ORCHESTRATOR-OWNED ACCEPTANCE TEST. Implementers must not modify this file.
// Contract: src/features/license/license.store.ts exposes pure(ish) record accessors that take a
// db handle (select/execute shape of @tauri-apps/plugin-sql Database), so they are testable
// without mocking module internals. App code binds them to getDb() via thin convenience wrappers
// (not under contract here). Record shape and `app_meta` storage per wave-30 Decision D4.
import { describe, expect, it, vi } from "vitest";

import {
  type ActivationRecord,
  readActivationRecord,
  writeActivationRecord,
} from "../features/license/license.store";

type DbLike = {
  select: ReturnType<typeof vi.fn>;
  execute: ReturnType<typeof vi.fn>;
};

function stubDb(): DbLike {
  return {
    select: vi.fn().mockResolvedValue([]),
    execute: vi.fn().mockResolvedValue(undefined),
  };
}

const RECORD: ActivationRecord = {
  licenseKey: "38b1460a-5104-4067-a91d-77b872934d51",
  instanceId: "47596ad9-a811-4ebf-ac8a-03fc7b6d2a17",
  activatedAt: "2026-06-10T00:00:00.000Z",
};

describe("license.store — activation record round-trip contract (app_meta)", () => {
  it("writeActivationRecord upserts the record as JSON under the 'license' key in app_meta", async () => {
    const db = stubDb();
    await writeActivationRecord(db, RECORD);
    expect(db.execute).toHaveBeenCalledTimes(1);
    const [sql, params] = db.execute.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/app_meta/);
    expect(params).toContain("license");
    const jsonParam = (params as string[]).find((p) => typeof p === "string" && p.startsWith("{"));
    expect(jsonParam).toBeDefined();
    expect(JSON.parse(jsonParam as string)).toEqual(RECORD);
  });

  it("readActivationRecord returns null when no row exists", async () => {
    const db = stubDb();
    db.select.mockResolvedValue([]);
    await expect(readActivationRecord(db)).resolves.toBeNull();
  });

  it("readActivationRecord returns the parsed record when the row exists", async () => {
    const db = stubDb();
    db.select.mockResolvedValue([{ value: JSON.stringify(RECORD) }]);
    await expect(readActivationRecord(db)).resolves.toEqual(RECORD);
  });

  it("readActivationRecord returns null (does not throw) on corrupt JSON", async () => {
    const db = stubDb();
    db.select.mockResolvedValue([{ value: "{not-json" }]);
    await expect(readActivationRecord(db)).resolves.toBeNull();
  });

  it("readActivationRecord returns null when the JSON is valid but missing required fields", async () => {
    const db = stubDb();
    db.select.mockResolvedValue([{ value: JSON.stringify({ licenseKey: "x" }) }]);
    await expect(readActivationRecord(db)).resolves.toBeNull();
  });

  it("round-trips: what write persists, read returns", async () => {
    const db = stubDb();
    await writeActivationRecord(db, RECORD);
    const [, params] = db.execute.mock.calls[0] as [string, string[]];
    const persisted = params.find((p) => typeof p === "string" && p.startsWith("{")) as string;
    db.select.mockResolvedValue([{ value: persisted }]);
    await expect(readActivationRecord(db)).resolves.toEqual(RECORD);
  });
});
