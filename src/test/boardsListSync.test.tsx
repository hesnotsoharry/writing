// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BrainstormSection } from "../binder/BrainstormSection";
import { runMigrations } from "../db/migrations";
import { getDb } from "../db/schema";
import { SYNC_ROWS_APPLIED_EVENT } from "../sync/syncEvents";
import { makeSqlJsDb, type SqlJsTestDb } from "./support/sqljsDb";

/**
 * Problem A step 3: the binder's Boards section (BrainstormSection) fetches
 * once per activeProjectId with no listener — a board created on another
 * device lands in SQLite via sync with no re-render until remount. Verifies
 * the SYNC_ROWS_APPLIED_EVENT{domain:"boards"} listener re-fetches.
 */

vi.mock("../db/schema", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db/schema")>();
  return { ...actual, getDb: vi.fn() };
});

let db: SqlJsTestDb;

beforeEach(async () => {
  db = await makeSqlJsDb();
  await runMigrations(db);
  vi.mocked(getDb).mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);
  await db.execute(
    "INSERT INTO boards (id, project_id, title, sort) VALUES ($1, $2, $3, $4)",
    ["b1", "p1", "Existing board", 0],
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  db.close();
});

describe("BrainstormSection — boards list re-fetches on sync apply", () => {
  it("shows a board inserted by a remote apply after SYNC_ROWS_APPLIED_EVENT{domain:'boards'} fires", async () => {
    render(<BrainstormSection activeProjectId="p1" onOpenBoard={vi.fn()} />);
    await screen.findByText("Existing board");

    // Simulate what sqlDomain.ts's projectReceived does on a remote row apply:
    // write straight into SQLite, then dispatch the event.
    await db.execute(
      "INSERT INTO boards (id, project_id, title, sort) VALUES ($1, $2, $3, $4)",
      ["b2", "p1", "Synced board", 1],
    );
    act(() => {
      window.dispatchEvent(new CustomEvent(SYNC_ROWS_APPLIED_EVENT, { detail: { domain: "boards" } }));
    });

    await waitFor(() => expect(screen.getByText("Synced board")).toBeInTheDocument());
  });

  it("ignores SYNC_ROWS_APPLIED_EVENT for an unrelated domain", async () => {
    render(<BrainstormSection activeProjectId="p1" onOpenBoard={vi.fn()} />);
    await screen.findByText("Existing board");

    await db.execute(
      "INSERT INTO boards (id, project_id, title, sort) VALUES ($1, $2, $3, $4)",
      ["b2", "p1", "Should not appear yet", 1],
    );
    act(() => {
      window.dispatchEvent(new CustomEvent(SYNC_ROWS_APPLIED_EVENT, { detail: { domain: "goals" } }));
    });

    // Give any accidental refetch a tick, then assert it did not happen.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(screen.queryByText("Should not appear yet")).toBeNull();
  });
});
