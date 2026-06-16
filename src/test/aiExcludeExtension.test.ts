/**
 * AiExcludeExtension — unit-level contract tests
 *
 * These tests verify the extension's static contract: name, command presence,
 * and HTML render/parse shape. They do NOT assert ProseMirror editor DOM
 * (jsdom cannot host ProseMirror correctly — see memory
 * `editor-behavior-needs-cdp-smoke-not-jsdom`). Runtime toggle behavior and
 * Yjs persistence are verified via CDP smoke by the orchestrator.
 */
import { describe, expect, it } from "vitest";

import AiExcludeExtension from "../editor/extensions/AiExcludeExtension";

describe("AiExcludeExtension static contract", () => {
  it("has name aiExclude — Phase 2 Yjs delta attribute key depends on this exact name", () => {
    expect(AiExcludeExtension.name).toBe("aiExclude");
  });

  it("exposes setAiExclude command — wired to commands.setMark", () => {
    const commands = AiExcludeExtension.config.addCommands?.call(
      AiExcludeExtension as Parameters<NonNullable<typeof AiExcludeExtension.config.addCommands>>[0],
    );
    expect(commands).toHaveProperty("setAiExclude");
    expect(typeof commands?.setAiExclude).toBe("function");
  });

  it("exposes toggleAiExclude command — used by FormatBubble toggle button", () => {
    const commands = AiExcludeExtension.config.addCommands?.call(
      AiExcludeExtension as Parameters<NonNullable<typeof AiExcludeExtension.config.addCommands>>[0],
    );
    expect(commands).toHaveProperty("toggleAiExclude");
    expect(typeof commands?.toggleAiExclude).toBe("function");
  });

  it("exposes unsetAiExclude command — allows removing the mark explicitly", () => {
    const commands = AiExcludeExtension.config.addCommands?.call(
      AiExcludeExtension as Parameters<NonNullable<typeof AiExcludeExtension.config.addCommands>>[0],
    );
    expect(commands).toHaveProperty("unsetAiExclude");
    expect(typeof commands?.unsetAiExclude).toBe("function");
  });

  it("renderHTML emits span tag with class ai-exclude and data-ai-exclude=true — CSS hook + Phase 2 parse target", () => {
    const result = AiExcludeExtension.config.renderHTML?.({
      mark: { attrs: {} } as Parameters<NonNullable<typeof AiExcludeExtension.config.renderHTML>>[0]["mark"],
      HTMLAttributes: {},
    });
    // result is a TipTap render tuple: ['span', { class, data-ai-exclude }, 0]
    expect(Array.isArray(result)).toBe(true);
    const tuple = result as unknown[];
    expect(tuple[0]).toBe("span");
    const attrs = tuple[1] as Record<string, string>;
    expect(attrs["class"]).toBe("ai-exclude");
    expect(attrs["data-ai-exclude"]).toBe("true");
    // The content hole '0' must be present — marks without it swallow their content
    expect(tuple[2]).toBe(0);
  });

  it("parseHTML targets span[data-ai-exclude] — round-trips through HTML and Yjs serialization", () => {
    const rules = AiExcludeExtension.config.parseHTML?.();
    expect(Array.isArray(rules)).toBe(true);
    expect(rules).toHaveLength(1);
    expect((rules as Array<{ tag: string }>)[0].tag).toBe("span[data-ai-exclude]");
  });
});
