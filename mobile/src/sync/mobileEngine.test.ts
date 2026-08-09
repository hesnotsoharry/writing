import { beforeEach, describe, expect, it, vi } from "vitest";

import { mobileLocalWrites } from "../db/mobileLocalWriteBridge";
import type { EngineOptions } from "../shared/engine";
import {
  mobileEngine,
  setMobileAiConversationsSyncEnabled,
} from "./mobileEngine";

const engineCapture = vi.hoisted(() => ({
  options: undefined as EngineOptions | undefined,
  publishRow: vi.fn(async () => true),
}));

vi.mock("../db/database", () => ({ getMobileDb: vi.fn() }));
vi.mock("../shared/provider", () => ({ RelayProvider: class {} }));
vi.mock("./mobileKeyStorage", () => ({ getSyncMasterKey: vi.fn() }));
vi.mock("./mobileDeviceId", () => ({ getOrCreateMobileDeviceId: vi.fn() }));
vi.mock("../shared/engine", () => ({
  SyncEngine: class {
    publishRow = engineCapture.publishRow;
    constructor(options: EngineOptions) { engineCapture.options = options; }
    onStructureChanged(): void {}
    onDocReplaced(): void {}
  },
}));

describe("mobile engine replication wiring", () => {
  beforeEach(() => engineCapture.publishRow.mockClear());

  it("installs meta, Bible, and row-publish local bridges", async () => {
    expect(engineCapture.options?.subscribeMetaSaves).toBeTypeOf("function");
    expect(engineCapture.options?.subscribeBibleSaves).toBeTypeOf("function");
    expect(engineCapture.options?.bibleApplyTarget).toBeDefined();

    const mutation = {
      domain: "goals" as const,
      projectId: "project-1",
      rowId: "goal-1",
      deleted: false,
    };
    mobileLocalWrites.notify(mutation);
    expect(engineCapture.publishRow).toHaveBeenCalledWith(mutation);
    await engineCapture.publishRow.mock.results[0]?.value;
  });

  it("keeps AI unregistered until the privacy setting is enabled", () => {
    expect(engineCapture.options?.lwwRegistry?.get("ai_conversations")).toBeNull();
    mobileLocalWrites.notify({ domain: "ai_conversations", projectId: "project-1",
      rowId: "conversation:c1", deleted: false });
    expect(engineCapture.publishRow).not.toHaveBeenCalled();
    setMobileAiConversationsSyncEnabled(true);
    expect(engineCapture.options?.lwwRegistry?.get("ai_conversations")).not.toBeNull();
    mobileLocalWrites.notify({ domain: "ai_conversations", projectId: "project-1",
      rowId: "conversation:c1", deleted: false });
    expect(engineCapture.publishRow).toHaveBeenCalledOnce();
    setMobileAiConversationsSyncEnabled(false);
    expect(engineCapture.options?.lwwRegistry?.get("ai_conversations")).toBeNull();
  });

  it("constructs the exported singleton", () => {
    expect(mobileEngine).toBeDefined();
  });
});
