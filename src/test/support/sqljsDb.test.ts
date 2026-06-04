import { describe, expect, it } from "vitest";

import { makeSqlJsDb } from "./sqljsDb";

describe("makeSqlJsDb — parameterized binding", () => {
  it("binds parameters on execute() and retrieves bound data with select()", async () => {
    const db = await makeSqlJsDb();
    try {
      // Create table
      await db.execute("CREATE TABLE t (id TEXT PRIMARY KEY, val TEXT)");

      // Insert with parameterized values using ? placeholders
      await db.execute("INSERT INTO t (id, val) VALUES (?, ?)", ["a", "hello"]);

      // Verify the row was inserted and bound correctly
      const rows = await db.select<{ id: string; val: string }[]>(
        "SELECT val FROM t WHERE id = ?",
        ["a"]
      );

      expect(rows).toEqual([{ val: "hello" }]);

      // Verify the INSERT SQL was recorded in executeCalls
      expect(db.executeCalls).toContain(
        "INSERT INTO t (id, val) VALUES (?, ?)"
      );
    } finally {
      db.close();
    }
  });

  it("select() returns empty array when WHERE condition matches no rows", async () => {
    const db = await makeSqlJsDb();
    try {
      await db.execute("CREATE TABLE t (id TEXT PRIMARY KEY, val TEXT)");
      await db.execute("INSERT INTO t (id, val) VALUES (?, ?)", ["a", "hello"]);

      // Query for non-existent id
      const rows = await db.select<{ val: string }[]>(
        "SELECT val FROM t WHERE id = ?",
        ["nonexistent"]
      );

      expect(rows).toEqual([]);
    } finally {
      db.close();
    }
  });
});
