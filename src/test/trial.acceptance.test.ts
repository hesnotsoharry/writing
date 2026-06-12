// Wave 33 Phase 1 — ORCHESTRATOR-OWNED ACCEPTANCE TEST. Implementers must not modify this file.
// Contract: src/features/license/trial.ts exposes pure trial-status logic and
// src/features/license/trial.store.ts exposes db-handle-first record accessors,
// both testable without module mocking. Trial math per Decision D3 (clock-rollback clamp);
// storage per Decision D2 (app_meta KV table under key 'trial').
import { describe, expect, it, vi } from "vitest";

import {
  TRIAL_DURATION_DAYS,
  computeTrialStatus,
} from "../features/license/trial";
import type { TrialRecord } from "../features/license/trial";
import {
  readTrialRecord,
  writeTrialRecord,
} from "../features/license/trial.store";

// The store's handle type — plain mock functions satisfy via cast.
type StoreDb = Parameters<typeof readTrialRecord>[0];

function stubDb() {
  const select = vi.fn().mockResolvedValue([]);
  const execute = vi.fn().mockResolvedValue(undefined);
  return { select, execute, db: { select, execute } as unknown as StoreDb };
}

// Fixed timestamps for deterministic test cases (all UTC).
const TRIAL_START = new Date("2026-06-01T00:00:00.000Z");
const TRIAL_START_ISO = "2026-06-01T00:00:00.000Z";

describe("trial — pure 14-day status logic (clock-rollback clamp)", () => {
  describe("computeTrialStatus", () => {
    it("TRIAL_DURATION_DAYS is 14", () => {
      expect(TRIAL_DURATION_DAYS).toBe(14);
    });

    it("returns { state: 'active', daysLeft: 14 } at trial start (now === trialStartedAt)", () => {
      const record: TrialRecord = {
        trialStartedAt: TRIAL_START_ISO,
        lastSeenAt: TRIAL_START_ISO,
      };
      const now = new Date(TRIAL_START);
      const status = computeTrialStatus(record, now);
      expect(status).toEqual({ state: "active", daysLeft: 14 });
    });

    it("returns { state: 'active', daysLeft: 1 } at 13 days 12 hours (0.5 days left, ceil to 1)", () => {
      const now = new Date(TRIAL_START.getTime() + 13.5 * 86400000);
      const record: TrialRecord = {
        trialStartedAt: TRIAL_START_ISO,
        lastSeenAt: now.toISOString(),
      };
      const status = computeTrialStatus(record, now);
      expect(status).toEqual({ state: "active", daysLeft: 1 });
    });

    it("returns { state: 'expired', daysLeft: 0 } exactly at 14 days", () => {
      const now = new Date(TRIAL_START.getTime() + 14 * 86400000);
      const record: TrialRecord = {
        trialStartedAt: TRIAL_START_ISO,
        lastSeenAt: now.toISOString(),
      };
      const status = computeTrialStatus(record, now);
      expect(status).toEqual({ state: "expired", daysLeft: 0 });
    });

    it("returns { state: 'expired', daysLeft: 0 } at 20 days", () => {
      const now = new Date(TRIAL_START.getTime() + 20 * 86400000);
      const record: TrialRecord = {
        trialStartedAt: TRIAL_START_ISO,
        lastSeenAt: now.toISOString(),
      };
      const status = computeTrialStatus(record, now);
      expect(status).toEqual({ state: "expired", daysLeft: 0 });
    });

    it("clamps to lastSeenAt when clock rolls backward (now < lastSeenAt): rollback 8 days -> daysLeft 4, not 12", () => {
      // lastSeenAt = start + 10 days, now = start + 2 days (clock set back 8 days)
      // effectiveNow = max(now, lastSeenAt) = start + 10 days
      // daysLeft = ceil((start + 14 days - (start + 10 days)) / 86400000) = 4
      const lastSeenAt = new Date(TRIAL_START.getTime() + 10 * 86400000);
      const now = new Date(TRIAL_START.getTime() + 2 * 86400000);
      const record: TrialRecord = {
        trialStartedAt: TRIAL_START_ISO,
        lastSeenAt: lastSeenAt.toISOString(),
      };
      const status = computeTrialStatus(record, now);
      expect(status).toEqual({ state: "active", daysLeft: 4 });
    });

    it("clamps to lastSeenAt when clock rolls backward past expiry: cannot un-expire", () => {
      // lastSeenAt = start + 15 days (expired), now = start + 1 day (clock set back 14 days)
      // effectiveNow = max(start + 1 day, start + 15 days) = start + 15 days
      // daysLeft = ceil((start + 14 days - (start + 15 days)) / 86400000) = ceil(-1 day) = 0 (clamped)
      const lastSeenAt = new Date(TRIAL_START.getTime() + 15 * 86400000);
      const now = new Date(TRIAL_START.getTime() + 1 * 86400000);
      const record: TrialRecord = {
        trialStartedAt: TRIAL_START_ISO,
        lastSeenAt: lastSeenAt.toISOString(),
      };
      const status = computeTrialStatus(record, now);
      expect(status).toEqual({ state: "expired", daysLeft: 0 });
    });

    it("uses now (not lastSeenAt) when clock advances normally: now = start + 5 days, lastSeenAt = start + 3 days -> daysLeft 9", () => {
      // effectiveNow = max(start + 5 days, start + 3 days) = start + 5 days
      // daysLeft = ceil((start + 14 days - (start + 5 days)) / 86400000) = 9
      const lastSeenAt = new Date(TRIAL_START.getTime() + 3 * 86400000);
      const now = new Date(TRIAL_START.getTime() + 5 * 86400000);
      const record: TrialRecord = {
        trialStartedAt: TRIAL_START_ISO,
        lastSeenAt: lastSeenAt.toISOString(),
      };
      const status = computeTrialStatus(record, now);
      expect(status).toEqual({ state: "active", daysLeft: 9 });
    });
  });

  describe("trial.store — record persistence (app_meta KV)", () => {
    const RECORD: TrialRecord = {
      trialStartedAt: "2026-06-01T00:00:00.000Z",
      lastSeenAt: "2026-06-01T00:00:00.000Z",
    };

    it("writeTrialRecord upserts the record as JSON under the 'trial' key in app_meta", async () => {
      const { execute, db } = stubDb();
      await writeTrialRecord(db, RECORD);
      expect(execute).toHaveBeenCalledTimes(1);
      const [sql, params] = execute.mock.calls[0] as [string, unknown[]];
      expect(sql).toMatch(/app_meta/);
      expect(params).toContain("trial");
      const jsonParam = (params as string[]).find(
        (p) => typeof p === "string" && p.startsWith("{"),
      );
      expect(jsonParam).toBeDefined();
      expect(JSON.parse(jsonParam as string)).toEqual(RECORD);
    });

    it("readTrialRecord returns null when no row exists", async () => {
      const { select, db } = stubDb();
      select.mockResolvedValue([]);
      await expect(readTrialRecord(db)).resolves.toBeNull();
    });

    it("readTrialRecord returns the parsed record when the row exists", async () => {
      const { select, db } = stubDb();
      select.mockResolvedValue([{ value: JSON.stringify(RECORD) }]);
      await expect(readTrialRecord(db)).resolves.toEqual(RECORD);
    });

    it("readTrialRecord returns null (never throws) on corrupt JSON", async () => {
      const { select, db } = stubDb();
      select.mockResolvedValue([{ value: "{not-json" }]);
      await expect(readTrialRecord(db)).resolves.toBeNull();
    });

    it("readTrialRecord returns null when JSON is valid but missing required fields (e.g. no lastSeenAt)", async () => {
      const { select, db } = stubDb();
      select.mockResolvedValue([
        { value: JSON.stringify({ trialStartedAt: "2026-06-01T00:00:00.000Z" }) },
      ]);
      await expect(readTrialRecord(db)).resolves.toBeNull();
    });

    it("round-trips: what write persists, read returns", async () => {
      const { select, execute, db } = stubDb();
      await writeTrialRecord(db, RECORD);
      const [, params] = execute.mock.calls[0] as [string, string[]];
      const persisted = params.find((p) => typeof p === "string" && p.startsWith("{")) as string;
      select.mockResolvedValue([{ value: persisted }]);
      await expect(readTrialRecord(db)).resolves.toEqual(RECORD);
    });
  });
});
