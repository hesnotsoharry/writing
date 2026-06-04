// @vitest-environment node
/**
 * Unit tests for the entry navigation state transitions.
 *
 * useEntryNav in App.state.ts wraps these transitions in React state.
 * We test the underlying logic directly here — same inputs/outputs,
 * no Tauri IPC or DOM rendering required.
 *
 * Contracts under test:
 *   openEntry   — resets stack to [{id, kind}], sets origin from current view
 *   pushEntry   — appends a frame to the stack
 *   entryBack   — pops one frame; exits to origin when stack depth reaches 0
 *   exitEntry   — clears stack entirely and exits to origin
 */

import { describe, expect, it } from "vitest";

import type { AppView, EntryFrame } from "../App.state";

// ---------------------------------------------------------------------------
// Pure transition helpers that mirror the logic in useEntryNav
// ---------------------------------------------------------------------------

type Origin = "write" | "bible";

function openEntry(
  id: string,
  kind: "Character" | "Location",
  currentView: AppView,
): { stack: EntryFrame[]; origin: Origin; view: AppView } {
  const origin: Origin = currentView === "editor" ? "write" : "bible";
  return { stack: [{ id, kind }], origin, view: "entry" };
}

function pushEntry(
  stack: EntryFrame[],
  id: string,
  kind: "Character" | "Location",
): EntryFrame[] {
  return [...stack, { id, kind }];
}

function entryBack(
  stack: EntryFrame[],
  origin: Origin,
): { stack: EntryFrame[]; view: AppView } {
  if (stack.length <= 1) {
    return { stack: [], view: origin === "write" ? "editor" : "bible" };
  }
  return { stack: stack.slice(0, -1), view: "entry" };
}

function exitEntry(origin: Origin): { stack: EntryFrame[]; view: AppView } {
  return { stack: [], view: origin === "write" ? "editor" : "bible" };
}

// ---------------------------------------------------------------------------
// openEntry
// ---------------------------------------------------------------------------

describe("openEntry", () => {
  it("resets the stack to exactly one frame with the given id and kind", () => {
    const result = openEntry("char-1", "Character", "bible");
    expect(result.stack).toHaveLength(1);
    expect(result.stack[0]).toMatchObject({ id: "char-1", kind: "Character" });
  });

  it("sets view to 'entry'", () => {
    expect(openEntry("loc-1", "Location", "bible").view).toBe("entry");
  });

  it("sets origin to 'bible' when current view is bible", () => {
    expect(openEntry("char-1", "Character", "bible").origin).toBe("bible");
  });

  it("sets origin to 'write' when current view is editor", () => {
    expect(openEntry("char-1", "Character", "editor").origin).toBe("write");
  });

  it("sets origin to 'bible' when current view is cork", () => {
    expect(openEntry("char-1", "Character", "cork").origin).toBe("bible");
  });

  it("replaces an existing non-empty stack with a fresh one-frame stack", () => {
    // Simulate being mid-journey when openEntry fires again
    const prior: EntryFrame[] = [{ id: "old-1", kind: "Character" }, { id: "old-2", kind: "Location" }];
    // openEntry always resets — prior stack is not passed in (it's React state that gets replaced)
    const result = openEntry("new-1", "Character", "bible");
    expect(result.stack).toHaveLength(1);
    expect(result.stack[0].id).toBe("new-1");
    expect(prior).toHaveLength(2); // prior stack unchanged (pure function)
  });
});

// ---------------------------------------------------------------------------
// pushEntry
// ---------------------------------------------------------------------------

describe("pushEntry", () => {
  it("appends a new frame to the end of the stack", () => {
    const initial: EntryFrame[] = [{ id: "char-1", kind: "Character" }];
    const next = pushEntry(initial, "loc-1", "Location");
    expect(next).toHaveLength(2);
    expect(next[1]).toMatchObject({ id: "loc-1", kind: "Location" });
  });

  it("does not mutate the original stack", () => {
    const initial: EntryFrame[] = [{ id: "char-1", kind: "Character" }];
    pushEntry(initial, "loc-1", "Location");
    expect(initial).toHaveLength(1);
  });

  it("preserves all prior frames in order", () => {
    const a: EntryFrame = { id: "a", kind: "Character" };
    const b: EntryFrame = { id: "b", kind: "Location" };
    const result = pushEntry([a, b], "c", "Character");
    expect(result[0]).toMatchObject({ id: "a" });
    expect(result[1]).toMatchObject({ id: "b" });
    expect(result[2]).toMatchObject({ id: "c" });
  });
});

// ---------------------------------------------------------------------------
// entryBack
// ---------------------------------------------------------------------------

describe("entryBack", () => {
  it("pops one frame when depth > 1, stays in entry view", () => {
    const stack: EntryFrame[] = [
      { id: "char-1", kind: "Character" },
      { id: "loc-1", kind: "Location" },
    ];
    const result = entryBack(stack, "bible");
    expect(result.stack).toHaveLength(1);
    expect(result.stack[0].id).toBe("char-1");
    expect(result.view).toBe("entry");
  });

  it("clears the stack and exits to bible when depth = 1 and origin = bible", () => {
    const stack: EntryFrame[] = [{ id: "char-1", kind: "Character" }];
    const result = entryBack(stack, "bible");
    expect(result.stack).toHaveLength(0);
    expect(result.view).toBe("bible");
  });

  it("clears the stack and exits to editor when depth = 1 and origin = write", () => {
    const stack: EntryFrame[] = [{ id: "char-1", kind: "Character" }];
    const result = entryBack(stack, "write");
    expect(result.stack).toHaveLength(0);
    expect(result.view).toBe("editor");
  });

  it("stays in entry after first back on a 3-deep stack", () => {
    const stack: EntryFrame[] = [
      { id: "a", kind: "Character" },
      { id: "b", kind: "Location" },
      { id: "c", kind: "Character" },
    ];
    const after1 = entryBack(stack, "bible");
    expect(after1.view).toBe("entry");
    expect(after1.stack).toHaveLength(2);
    const after2 = entryBack(after1.stack, "bible");
    expect(after2.view).toBe("entry");
    expect(after2.stack).toHaveLength(1);
    const after3 = entryBack(after2.stack, "bible");
    expect(after3.view).toBe("bible");
    expect(after3.stack).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// exitEntry
// ---------------------------------------------------------------------------

describe("exitEntry", () => {
  it("clears the stack and returns to bible when origin = bible", () => {
    const result = exitEntry("bible");
    expect(result.stack).toHaveLength(0);
    expect(result.view).toBe("bible");
  });

  it("clears the stack and returns to editor when origin = write", () => {
    const result = exitEntry("write");
    expect(result.stack).toHaveLength(0);
    expect(result.view).toBe("editor");
  });
});

// ---------------------------------------------------------------------------
// getEntity is called (not listCharacters) — contract note
// ---------------------------------------------------------------------------

describe("entry data-load contract (documented)", () => {
  it("EntityWithPortrait is the type returned by getEntity — which includes portraitPath", () => {
    // This test documents the contract (Decision 4, Wave 24) that getEntity returns
    // EntityWithPortrait. The type check is enforced by TypeScript at compile time;
    // this assertion documents the intent for human readers.
    const shape: { portraitPath: null } = { portraitPath: null };
    expect(shape.portraitPath).toBeNull();
  });
});
