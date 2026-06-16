/**
 * @vitest-environment jsdom
 *
 * Consent-gate unit test for the "Ask assistant" affordance in FormatButtons
 * (W52 Phase 3).
 *
 * Contract:
 *  - The "Ask assistant" button is ABSENT when aiConsentGiven is false
 *    (regardless of aiEnabled / aiSelPill state).
 *  - The "Ask assistant" button is PRESENT when aiEnabled=true,
 *    aiConsentGiven=true, and aiSelPill=true.
 *  - The button remains ABSENT when aiEnabled is false even if consent is given.
 *  - The button remains ABSENT when aiSelPill is false even if consent is given.
 *
 * Why this seam: getTweak reads from localStorage — we control that directly
 * in jsdom without needing to mock the module. FormatButtons is a pure
 * presentational component (no BubbleMenu geometry), so it renders cleanly
 * in jsdom with a minimal editor stub.
 *
 * CDP-smoke note (per memory editor-behavior-needs-cdp-smoke-not-jsdom):
 * BubbleMenu show/hide is ProseMirror geometry — untestable in jsdom. These
 * tests cover only the consent-gate render logic (does the button exist when
 * conditions are met?), NOT the bubble appearance on selection.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FormatButtons } from "../editor/FormatBubble";
import { SETTINGS_NS } from "../features/settings/settings.store";

// ── Minimal editor stub ───────────────────────────────────────────────────────
// FormatButtons only needs: isActive(), chain(), state.selection.{from,to},
// state.doc (for extractAiSafeSelection), and chain().focus()...run() no-ops.
// We do NOT stub editor behaviour — only the surface FormatButtons touches.

function makeEditorStub() {
  const noopChain = new Proxy(
    {},
    {
      get: () => () => noopChain,
    },
  );
  return {
    isActive: () => false,
    chain: () => noopChain,
    state: {
      selection: { from: 0, to: 0, empty: true },
      doc: {
        nodesBetween: () => undefined,
      },
    },
  } as unknown as import("@tiptap/react").Editor;
}

// ── localStorage helpers ──────────────────────────────────────────────────────

function setTweaks(overrides: Record<string, unknown>) {
  for (const [key, value] of Object.entries(overrides)) {
    localStorage.setItem(SETTINGS_NS + key, JSON.stringify(value));
  }
}

function clearTweaks() {
  localStorage.clear();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("FormatButtons — Ask assistant consent gate", () => {
  afterEach(() => {
    cleanup();
    clearTweaks();
  });

  it("hides Ask assistant when aiConsentGiven is false (default)", () => {
    // No localStorage entries → getTweak falls back to defaults
    // aiEnabled default=true, aiConsentGiven default=false, aiSelPill default=true
    const editor = makeEditorStub();
    render(<FormatButtons editor={editor} />);
    expect(screen.queryByRole("button", { name: "Ask assistant" })).toBeNull();
  });

  it("shows Ask assistant when aiEnabled, aiConsentGiven, and aiSelPill are all true", () => {
    setTweaks({ aiEnabled: true, aiConsentGiven: true, aiSelPill: true });
    const editor = makeEditorStub();
    render(<FormatButtons editor={editor} />);
    expect(screen.getByRole("button", { name: "Ask assistant" })).toBeTruthy();
  });

  it("hides Ask assistant when aiEnabled is false even with consent given", () => {
    setTweaks({ aiEnabled: false, aiConsentGiven: true, aiSelPill: true });
    const editor = makeEditorStub();
    render(<FormatButtons editor={editor} />);
    expect(screen.queryByRole("button", { name: "Ask assistant" })).toBeNull();
  });

  it("hides Ask assistant when aiSelPill is false even with consent given", () => {
    setTweaks({ aiEnabled: true, aiConsentGiven: true, aiSelPill: false });
    const editor = makeEditorStub();
    render(<FormatButtons editor={editor} />);
    expect(screen.queryByRole("button", { name: "Ask assistant" })).toBeNull();
  });

  it("plain formatting buttons (Bold, Italic) are present regardless of consent state", () => {
    // aiConsentGiven=false — formatting is ungated
    const editor = makeEditorStub();
    render(<FormatButtons editor={editor} />);
    expect(screen.getByRole("button", { name: "Bold" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Italic" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Hide from AI" })).toBeTruthy();
  });
});
