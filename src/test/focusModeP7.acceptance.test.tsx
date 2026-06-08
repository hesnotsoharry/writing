// @vitest-environment jsdom
/**
 * focusModeP7.acceptance.test.tsx — ORCHESTRATOR-OWNED acceptance test for Wave 28 Phase 7.
 *
 * Architecture change (wave-28 P7, Decision 9 Q-FOCUSPM): focus-mode effects moved from
 * the broken pure-DOM hook (focusEffects.ts, deleted) to a ProseMirror-native
 * FocusModeExtension. The old `useFocusEditorEffects` / `data-focused` tests are removed —
 * they tested a dead path (PM's MutationObserver reverts external DOM mutations within ~800ms).
 *
 * Behavioral coverage (dim persistence, typewriter scroll, no-loop) is verified by CDP
 * smoke per Decision 9 (Q-FOCUSPM); jsdom covers structure only.
 *
 * Retained contract:
 *   Q-HUDOPACITY (Decision 6, LOCKED 0.6): the `.focus-hud.faded` CSS rule resolves to
 *   opacity 0.6. The faded HUD must stay glanceable.
 *
 * New structural contract (FocusModeExtension sanity):
 *   - Extension name is "focusMode".
 *   - configure() with all flags returns an extension (module loads, options type-check).
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import FocusModeExtension from "../editor/extensions/FocusModeExtension";

const here = dirname(fileURLToPath(import.meta.url));

describe("Wave 28 P7 — Q-HUDOPACITY (faded HUD opacity)", () => {
  it(".focus-hud.faded resolves to opacity 0.6 in app.css", () => {
    const css = readFileSync(resolve(here, "../styles/app.css"), "utf8");
    const match = css.match(/\.focus-hud\.faded\s*\{[^}]*opacity:\s*([\d.]+)/);
    expect(match, ".focus-hud.faded rule with an opacity value must exist").not.toBeNull();
    expect(Number(match![1])).toBe(0.6);
  });
});

describe("Wave 28 P7 — FocusModeExtension structural contract", () => {
  it("extension name is 'focusMode'", () => {
    expect(FocusModeExtension.name).toBe("focusMode");
  });

  it("configure({ focusMode: true, dimOn: true, typewriterOn: true }) returns a TipTap extension", () => {
    const ext = FocusModeExtension.configure({ focusMode: true, dimOn: true, typewriterOn: true });
    expect(ext).toBeTruthy();
    expect(ext.name).toBe("focusMode");
  });

  it("configure({ focusMode: false, dimOn: false, typewriterOn: false }) returns a TipTap extension", () => {
    const ext = FocusModeExtension.configure({ focusMode: false, dimOn: false, typewriterOn: false });
    expect(ext).toBeTruthy();
    expect(ext.name).toBe("focusMode");
  });
});
