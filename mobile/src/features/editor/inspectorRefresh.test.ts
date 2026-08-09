import { describe, expect, it, vi } from "vitest";

import { refreshOpenInspector } from "./inspectorRefresh";

describe("inspector refresh", () => {
  it("reloads an open inspector whenever its screen receives focus", () => {
    const reload = vi.fn();
    refreshOpenInspector(true, reload);
    refreshOpenInspector(true, reload);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("does not query inspector data while the sheet is closed", () => {
    const reload = vi.fn();
    refreshOpenInspector(false, reload);
    expect(reload).not.toHaveBeenCalled();
  });
});
