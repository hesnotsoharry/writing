import { describe, expect, it, vi } from "vitest";

import { setFocusKeepAwake } from "./keepAwake";

describe("focus keep-awake", () => {
  it("activates and releases the same native wake-lock tag", async () => {
    const port = {
      activateKeepAwakeAsync: vi.fn(async () => undefined),
      deactivateKeepAwake: vi.fn(async () => undefined),
    };
    await setFocusKeepAwake(true, port);
    await setFocusKeepAwake(false, port);
    expect(port.activateKeepAwakeAsync).toHaveBeenCalledWith("writersnook-focus");
    expect(port.deactivateKeepAwake).toHaveBeenCalledWith("writersnook-focus");
  });
});
