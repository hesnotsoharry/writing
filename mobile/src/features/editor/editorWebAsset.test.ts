import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const downloadAsync = vi.fn();
  const fromModule = vi.fn(() => ({ downloadAsync, localUri: "file:///editor/index.html" }));
  return { downloadAsync, fromModule };
});

vi.mock("expo-asset", () => ({ Asset: { fromModule: mocks.fromModule } }));

import { getEditorWebAssetUri } from "./editorWebAsset";

describe("getEditorWebAssetUri", () => {
  beforeEach(() => {
    mocks.downloadAsync.mockReset().mockResolvedValue(undefined);
    mocks.fromModule.mockClear();
  });

  it("downloads the statically required HTML and returns its local URI", async () => {
    await expect(getEditorWebAssetUri(73)).resolves.toBe("file:///editor/index.html");
    expect(mocks.fromModule).toHaveBeenCalledWith(73);
    expect(mocks.downloadAsync).toHaveBeenCalledOnce();
  });
});
