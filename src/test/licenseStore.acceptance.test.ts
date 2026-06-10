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

// The store's handle type uses plugin-sql's generic select<T> signature, which plain mock
// functions can't structurally satisfy — the cast is the sanctioned seam for this stub.
type StoreDb = Parameters<typeof readActivationRecord>[0];

function stubDb() {
  const select = vi.fn().mockResolvedValue([]);
  const execute = vi.fn().mockResolvedValue(undefined);
  return { select, execute, db: { select, execute } as unknown as StoreDb };
}

const RECORD: ActivationRecord = {
  licenseKey: "38b1460a-5104-4067-a91d-77b872934d51",
  instanceId: "47596ad9-a811-4ebf-ac8a-03fc7b6d2a17",
  activatedAt: "2026-06-10T00:00:00.000Z",
};

describe("license.store — activation record round-trip contract (app_meta)", () => {
  it("writeActivationRecord upserts the record as JSON under the 'license' key in app_meta", async () => {
    const { execute, db } = stubDb();
    await writeActivationRecord(db, RECORD);
    expect(execute).toHaveBeenCalledTimes(1);
    const [sql, params] = execute.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/app_meta/);
    expect(params).toContain("license");
    const jsonParam = (params as string[]).find((p) => typeof p === "string" && p.startsWith("{"));
    expect(jsonParam).toBeDefined();
    expect(JSON.parse(jsonParam as string)).toEqual(RECORD);
  });

  it("readActivationRecord returns null when no row exists", async () => {
    const { select, db } = stubDb();
    select.mockResolvedValue([]);
    await expect(readActivationRecord(db)).resolves.toBeNull();
  });

  it("readActivationRecord returns the parsed record when the row exists", async () => {
    const { select, db } = stubDb();
    select.mockResolvedValue([{ value: JSON.stringify(RECORD) }]);
    await expect(readActivationRecord(db)).resolves.toEqual(RECORD);
  });

  it("readActivationRecord returns null (does not throw) on corrupt JSON", async () => {
    const { select, db } = stubDb();
    select.mockResolvedValue([{ value: "{not-json" }]);
    await expect(readActivationRecord(db)).resolves.toBeNull();
  });

  it("readActivationRecord returns null when the JSON is valid but missing required fields", async () => {
    const { select, db } = stubDb();
    select.mockResolvedValue([{ value: JSON.stringify({ licenseKey: "x" }) }]);
    await expect(readActivationRecord(db)).resolves.toBeNull();
  });

  it("round-trips: what write persists, read returns", async () => {
    const { select, execute, db } = stubDb();
    await writeActivationRecord(db, RECORD);
    const [, params] = execute.mock.calls[0] as [string, string[]];
    const persisted = params.find((p) => typeof p === "string" && p.startsWith("{")) as string;
    select.mockResolvedValue([{ value: persisted }]);
    await expect(readActivationRecord(db)).resolves.toEqual(RECORD);
  });
});
