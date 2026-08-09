import type { DbClient } from "@writersnook/db/dbClient";
import { describe, expect, it } from "vitest";

import { MobilePendingReplacementStore } from "./mobilePendingReplacementStore";
import { MobileProjectDomainDocStore } from "./mobileProjectDomainDocStore";
import { MobileSyncLwwStore } from "./mobileSyncLwwStore";
import { MobileSyncOutboxStore } from "./mobileSyncOutboxStore";

class RecordingDb implements DbClient {
  readonly queries: string[] = [];
  select<T>(sql: string): Promise<T> {
    this.queries.push(sql); return Promise.resolve([] as unknown as T);
  }
  execute(sql: string): Promise<{ rowsAffected: number }> {
    this.queries.push(sql); return Promise.resolve({ rowsAffected: 1 });
  }
}

describe("mobile sync stores", () => {
  it("compose the shared SQL contracts over the supplied mobile DbClient", async () => {
    const db = new RecordingDb();
    await new MobileProjectDomainDocStore(db).listAll();
    await new MobileSyncLwwStore(db).listScopes();
    await new MobileSyncOutboxStore(db).listPending();
    await new MobilePendingReplacementStore(db).list();
    expect(db.queries.join("\n")).toContain("project_domain_docs");
    expect(db.queries.join("\n")).toContain("sync_lww_rows");
    expect(db.queries.join("\n")).toContain("sync_outbox");
    expect(db.queries.join("\n")).toContain("sync_pending_replacements");
  });
});
