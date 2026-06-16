/**
 * @vitest-environment jsdom
 *
 * Regression test: useProseSelection suppression branch (W52 Phase 2).
 *
 * Proves the security-critical case: when the editor view is unregistered
 * (activeEditorRef.current === null) but a non-collapsed DOM selection exists
 * within a .prose element, the hook returns null and NEVER surfaces the raw
 * mark-blind DOM selection text. This prevents leaking content that should be
 * redacted by the mark-aware extraction path.
 *
 * Test mechanics:
 *  1. Build a .prose element with sensitive text ("secret explicit passage").
 *  2. Set activeEditorRef.current = null to simulate an unmounted editor.
 *  3. Create a real DOM Range over the text node (passes line 110/111 gates).
 *  4. Fire selectionchange event and assert the hook returns null.
 *  5. Dual assertion: prove the DOM selection HAD the text (assert raw text is
 *     non-empty), yet the hook still suppressed it (assert result is null).
 *     This pair fails if the suppression branch (line 114) is reverted to a
 *     raw s.toString() fallback.
 */
import { act,renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { activeEditorRef } from "../editor/aiSafeSelection";
import { useProseSelection } from "../features/ai/AssistantPanel.slot";

describe("useProseSelection — activeEditorRef suppression branch", () => {
  afterEach(() => {
    // Clean up DOM and reset the editor ref.
    activeEditorRef.current = null;
    document.body.innerHTML = "";
    // Deselect any active selection to avoid test pollution.
    document.getSelection()?.removeAllRanges();
  });

  it("suppresses selection entirely when activeEditorRef.current is null but DOM selection is non-empty within .prose", () => {
    // Build a .prose element with sensitive text.
    const proseEl = document.createElement("div");
    proseEl.className = "prose";
    const textNode = document.createTextNode(
      "Some introduction. secret explicit passage here. More text after.",
    );
    proseEl.appendChild(textNode);
    document.body.appendChild(proseEl);

    // Ensure editor ref is null (simulating unmounted editor).
    activeEditorRef.current = null;

    // Create a Range over the sensitive part of the text.
    const range = document.createRange();
    // Text is "Some introduction. secret explicit passage here. More text after."
    // "secret" starts at char 19 (after "Some introduction. ").
    // "secret explicit passage" spans chars 19–42.
    range.setStart(textNode, 19);
    range.setEnd(textNode, 42);

    // Apply the range to document selection.
    const selection = document.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    // Verify the DOM selection IS non-empty and contains the secret text.
    const rawDomText = selection.toString();
    expect(rawDomText).toContain("secret");
    expect(rawDomText).toContain("explicit passage");

    // Render the hook and fire selectionchange.
    const { result } = renderHook(() => useProseSelection());

    act(() => {
      document.dispatchEvent(new Event("selectionchange"));
    });

    // Core assertion: hook returns null despite the DOM having real sensitive text.
    // This proves the suppression branch (AssistantPanel.slot.ts:114:
    // `if (!view || view.state.selection.empty) { setSel(null); return; }`)
    // is active and working.
    //
    // Mutation verification: if the guard at line 114 were removed (e.g., by
    // deleting the entire `if (!view || view.state.selection.empty) { setSel(null); return; }`
    // block), this test would fail. The hook would then attempt to access
    // `view.state.selection` on a null view (throwing TypeError), OR if a fallback
    // were added (e.g., `const selText = s.toString()` + `parseProseSelection(selText)`),
    // the test would fail because result.current would no longer be null.
    expect(result.current).toBeNull();
  });

  it("does not leak raw DOM text; suppression is enforced even when selection is non-collapsed and inside .prose", () => {
    // Build .prose element with another sensitive example.
    const proseEl = document.createElement("div");
    proseEl.className = "prose";
    const sensitive = "This is a private thought that must not leak.";
    const textNode = document.createTextNode(sensitive);
    proseEl.appendChild(textNode);
    document.body.appendChild(proseEl);

    // Null editor ref = suppression condition.
    activeEditorRef.current = null;

    // Select the full sensitive text.
    const range = document.createRange();
    range.selectNodeContents(textNode);

    const selection = document.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    // Verify we have a real, non-empty DOM selection.
    const domText = selection.toString();
    expect(domText).toBe(sensitive);
    expect(domText).not.toBe(""); // Must be non-empty to test suppression.

    // Render hook and trigger selectionchange.
    const { result } = renderHook(() => useProseSelection());

    act(() => {
      document.dispatchEvent(new Event("selectionchange"));
    });

    // Assertion 1: the hook returned null (suppressed).
    expect(result.current).toBeNull();

    // Assertion 2: if the suppression were missing and the code fell back to
    // s.toString(), it WOULD return the raw DOM text. This assertion proves
    // that even though the raw text is available, the hook chose to suppress
    // it (not leak it). This pair of assertions fails if line 114 is replaced
    // with a raw-DOM fallback like `setSel({ text: s.toString(), ... })`.
    expect(domText).toContain("private");
  });

  it("returns null even when the .prose element is nested (anchorNode is deep, closest finds .prose)", () => {
    // Build a deeper structure: .prose > span > text node.
    const proseEl = document.createElement("div");
    proseEl.className = "prose";
    const span = document.createElement("span");
    const textNode = document.createTextNode("deep secret content");
    span.appendChild(textNode);
    proseEl.appendChild(span);
    document.body.appendChild(proseEl);

    // Null editor ref.
    activeEditorRef.current = null;

    // Select the text node (which is inside a span inside .prose).
    const range = document.createRange();
    range.selectNodeContents(textNode);

    const selection = document.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    expect(selection.toString()).toContain("deep secret");

    const { result } = renderHook(() => useProseSelection());

    act(() => {
      document.dispatchEvent(new Event("selectionchange"));
    });

    // The suppression branch is still hit because:
    // - s.isCollapsed is false (line 110: passes)
    // - proseElFromSelection(s) finds .prose via .closest() (line 111: passes)
    // - but activeEditorRef.current is null (line 113: SUPPRESSES)
    expect(result.current).toBeNull();
  });

  it("gate: returns null for collapsed selections (fails line 110 gate) without relying on suppression", () => {
    // This test confirms the earlier gates work, so that the suppression test
    // is isolated to the activeEditorRef.current === null condition.

    const proseEl = document.createElement("div");
    proseEl.className = "prose";
    proseEl.appendChild(document.createTextNode("some text"));
    document.body.appendChild(proseEl);

    activeEditorRef.current = null;

    // Create a collapsed (empty) selection.
    const selection = document.getSelection()!;
    selection.removeAllRanges();

    // Manually place a collapsed selection in the prose element.
    const range = document.createRange();
    range.collapse(true); // Collapsed.
    selection.addRange(range);

    const { result } = renderHook(() => useProseSelection());

    act(() => {
      document.dispatchEvent(new Event("selectionchange"));
    });

    // Returns null because line 110 gate fires (isCollapsed is true),
    // never reaching the suppression branch.
    expect(result.current).toBeNull();
  });

  it("gate: returns null when selection anchor is outside .prose (fails line 111 gate)", () => {
    // Confirm the proseElFromSelection gate also suppresses correctly.
    const outsideEl = document.createElement("div");
    outsideEl.className = "not-prose";
    const textNode = document.createTextNode("text outside prose");
    outsideEl.appendChild(textNode);
    document.body.appendChild(outsideEl);

    activeEditorRef.current = null;

    const range = document.createRange();
    range.selectNodeContents(textNode);

    const selection = document.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    expect(selection.toString()).toBe("text outside prose");

    const { result } = renderHook(() => useProseSelection());

    act(() => {
      document.dispatchEvent(new Event("selectionchange"));
    });

    // Returns null because proseElFromSelection fails (line 111 gate),
    // even though activeEditorRef.current is null.
    expect(result.current).toBeNull();
  });
});
