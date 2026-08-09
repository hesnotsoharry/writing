import { describe, expect, it, vi } from "vitest";

import { readAiSelection, registerAiSelection, runSelectionCommand } from "./selectionBridge";

describe("AI selection bridge", () => {
  it("keeps the AI-safe selection and routes sheet commands back to its editor", () => {
    const command = vi.fn();
    const snapshot = { sceneId: "scene-1", aiSafeText: "safe text", wordCount: 2,
      aiExcluded: false, rect: { x: 1, y: 2, width: 3, height: 4 } };
    const unregister = registerAiSelection(snapshot, command);
    expect(readAiSelection("scene-1")).toEqual(snapshot);
    expect(runSelectionCommand("scene-1", "copy")).toBe(true);
    expect(command).toHaveBeenCalledWith("copy");
    unregister();
    expect(readAiSelection("scene-1")).toBeNull();
  });
});
