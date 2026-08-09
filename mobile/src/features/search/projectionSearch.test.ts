import { describe, expect, it } from "vitest";

import { MobileSearchStore } from "../../db/mobileSearchStore";
import type { DbClient } from "../../shared/dbClient";

class ProjectionDb implements DbClient {
  sql = "";
  select<T>(sql: string): Promise<T> {
    this.sql = sql;
    return Promise.resolve([{ id: "s", title: "Scene", folder_title: null, plaintext_projection: "needle" }] as T);
  }
  execute(): Promise<{ rowsAffected: number }> { return Promise.resolve({ rowsAffected: 0 }); }
}

describe("mobile manuscript search persistence boundary", () => {
  it("selects plaintext_projection and never selects Yjs state", async () => {
    const db = new ProjectionDb();
    const matches = await new MobileSearchStore(db).searchManuscript("p", "needle");
    expect(matches).toHaveLength(1);
    expect(db.sql).toContain("sd.plaintext_projection");
    expect(db.sql).not.toContain("state_base64");
  });
});
