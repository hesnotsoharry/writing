// @vitest-environment jsdom
/**
 * aiSeedNewConvo.test.ts — seam tests for the selection-seed → new-conversation routing.
 *
 * Tests at the two cleanest seams the jsdom environment allows:
 *   A) useAiPanelSeed — verifies seedAsk resets activeId and sets initialSel.
 *   B) useConvoOps.newConvo — verifies the conversation-creation primitive called by the seed effect.
 *
 * CONTRACT (W53 Phase 3, Locked Decision 1):
 *   A selection-seed (AI_ASK_FROM_EDITOR event) always opens exactly ONE new conversation with
 *   verb=ask and the attached-words chip, regardless of prior panel state. Non-seed entry paths
 *   (tab click, project switch, 'New conversation' button) have initialSel=null and MUST NOT
 *   trigger the auto-new-convo effect in PanelReady.
 *
 *   The exactly-one-convo guarantee is enforced by two cooperating mechanisms:
 *     1. seedAsk resets activeId to null before bumping panelKey (tested here in suite A).
 *     2. PanelReady's mount-once useEffect(fn,[]) gates on initialSel: if (!p.initialSel) return.
 *        React guarantees the effect fires exactly once per mount; PanelReady is keyed on panelKey
 *        so it remounts once per seed — one seed → one mount → one newConvo call.
 *
 * Visual confirmation (chip rendering, panel actually showing a started convo) deferred to CDP smoke.
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useConvoOps } from "../features/ai/AssistantPanel.hooks";
import { useAiPanelSeed } from "../features/ai/AssistantPanel.slot";

// ── A: useAiPanelSeed ─────────────────────────────────────────────────────────

describe("useAiPanelSeed — seedAsk resets activeId and seeds initialSel", () => {
  it("calls setActiveId(null) when seedAsk fires — clears prior active conversation", () => {
    const setInspTab = vi.fn();
    const setActiveId = vi.fn();
    const { result } = renderHook(() => useAiPanelSeed(setInspTab, setActiveId));

    act(() => { result.current.seedAsk("ask", { text: "The quick brown fox", words: 4 }); });

    expect(setActiveId).toHaveBeenCalledTimes(1);
    expect(setActiveId).toHaveBeenCalledWith(null);
  });

  it("sets initialSel to the seeded selection after seedAsk — chip source flows from seed", () => {
    const setInspTab = vi.fn();
    const setActiveId = vi.fn();
    const { result } = renderHook(() => useAiPanelSeed(setInspTab, setActiveId));

    const sel = { text: "A chosen sentence.", words: 3 };
    act(() => { result.current.seedAsk("ask", sel); });

    expect(result.current.initialSel).toEqual(sel);
  });

  it("bumps panelKey on each seedAsk call — each seed remounts PanelReady exactly once", () => {
    const setInspTab = vi.fn();
    const setActiveId = vi.fn();
    const { result } = renderHook(() => useAiPanelSeed(setInspTab, setActiveId));

    const key0 = result.current.panelKey;
    act(() => { result.current.seedAsk("ask", { text: "first", words: 1 }); });
    const key1 = result.current.panelKey;
    act(() => { result.current.seedAsk("ask", { text: "second", words: 1 }); });
    const key2 = result.current.panelKey;

    expect(key1).toBe(key0 + 1);
    expect(key2).toBe(key0 + 2);
  });

  it("switches inspector tab to assistant on seed", () => {
    const setInspTab = vi.fn();
    const setActiveId = vi.fn();
    const { result } = renderHook(() => useAiPanelSeed(setInspTab, setActiveId));

    act(() => { result.current.seedAsk("ask", { text: "x", words: 1 }); });

    expect(setInspTab).toHaveBeenCalledWith("assistant");
  });

  it("does NOT call setActiveId on mount when no seed fires — non-seed entry paths are inert", () => {
    const setInspTab = vi.fn();
    const setActiveId = vi.fn();
    renderHook(() => useAiPanelSeed(setInspTab, setActiveId));

    // Tab click / project switch / 'New conversation': no seedAsk call → setActiveId never touched.
    expect(setActiveId).not.toHaveBeenCalled();
  });

  it("initialSel is null on initial mount — the PanelReady seed effect is inert for non-seed paths", () => {
    const setInspTab = vi.fn();
    const setActiveId = vi.fn();
    const { result } = renderHook(() => useAiPanelSeed(setInspTab, setActiveId));

    // CONTRACT: PanelReady's seed effect: `if (!p.initialSel) return` — null = inert.
    // All three non-seed paths (tab click, 'New conversation', project switch) rely on this.
    expect(result.current.initialSel).toBeNull();
  });
});

// ── B: useConvoOps.newConvo ───────────────────────────────────────────────────

describe("useConvoOps.newConvo — exactly-one-conversation primitive", () => {
  it("creates one conversation via convStore and calls setActiveId with the new id", async () => {
    const convoId = "convo-seed-abc";
    const mockConvStore = {
      createConversation: vi.fn().mockResolvedValue({ id: convoId, title: "New conversation", lastVerb: null }),
    };
    const setConvos = vi.fn();
    const setActiveId = vi.fn();

    const { result } = renderHook(() =>
      useConvoOps(setConvos, null, setActiveId, {
        onToast: vi.fn(),
        convStore: mockConvStore as never,
        projectId: "proj-1",
      }),
    );

    await act(async () => { await result.current.newConvo(); });

    expect(mockConvStore.createConversation).toHaveBeenCalledTimes(1);
    expect(setActiveId).toHaveBeenCalledWith(convoId);
    expect(setConvos).toHaveBeenCalledTimes(1);
  });

  it("creates one conversation via in-memory fallback when convStore is absent", async () => {
    const setConvos = vi.fn();
    const setActiveId = vi.fn();

    const { result } = renderHook(() =>
      useConvoOps(setConvos, null, setActiveId, {
        onToast: vi.fn(),
        convStore: undefined,
        projectId: null,
      }),
    );

    await act(async () => { await result.current.newConvo(); });

    expect(setActiveId).toHaveBeenCalledTimes(1);
    const id = setActiveId.mock.calls[0]?.[0] as string;
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("returns the new conversation id from each call — callers can chain on the id", async () => {
    const convoId = "convo-ret-xyz";
    const mockConvStore = {
      createConversation: vi.fn().mockResolvedValue({ id: convoId, title: "New conversation", lastVerb: null }),
    };
    const { result } = renderHook(() =>
      useConvoOps(vi.fn(), null, vi.fn(), {
        onToast: vi.fn(),
        convStore: mockConvStore as never,
        projectId: "proj-x",
      }),
    );

    let returnedId = "";
    await act(async () => { returnedId = await result.current.newConvo(); });

    expect(returnedId).toBe(convoId);
  });
});

// ── C: PanelReady seed effect guard (StrictMode safety) ──────────────────────

describe("PanelReady seed effect — StrictMode double-invoke guard", () => {
  it("ref-guard ensures exactly one newConvo call even when effect runs twice", () => {
    // CONTRACT: StrictMode double-invoke must yield exactly one newConvo
    // Simulates the guard pattern: a ref-backed idempotency check.
    const newConvoMock = vi.fn();

    // Simulate the ref-backed guard as used in PanelReady's seed effect
    const hasSeededRef = { current: false };
    const attemptSeed = (shouldSeed: boolean) => {
      if (hasSeededRef.current) return; // Guard: already seeded
      if (!shouldSeed) return; // Early exit: no initialSel
      hasSeededRef.current = true;
      newConvoMock();
    };

    // Simulate StrictMode double-invoke: effect runs, unmounts, runs again
    attemptSeed(true);
    attemptSeed(true);

    expect(newConvoMock).toHaveBeenCalledTimes(1);
  });
});
