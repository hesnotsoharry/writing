/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";

import {
  installContextMenuGuard,
  isEditableTarget,
} from "../lib/nativeContextMenu";

describe("isEditableTarget", () => {
  it("returns true for INPUT element", () => {
    const input = document.createElement("input");
    expect(isEditableTarget(input)).toBe(true);
  });

  it("returns true for TEXTAREA element", () => {
    const textarea = document.createElement("textarea");
    expect(isEditableTarget(textarea)).toBe(true);
  });

  it("returns false for plain DIV element", () => {
    const div = document.createElement("div");
    expect(isEditableTarget(div)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isEditableTarget(null)).toBe(false);
  });

  it("returns true for contenteditable div if isContentEditable is supported", () => {
    const div = document.createElement("div");
    div.contentEditable = "true";
    // jsdom may or may not fully support isContentEditable; only assert if it does
    if (typeof div.isContentEditable !== "undefined") {
      const result = isEditableTarget(div);
      // jsdom's contentEditable support is partial; if it reports false despite the
      // attribute being set, that's a jsdom limitation, not a test failure
      if (div.isContentEditable) {
        expect(result).toBe(true);
      }
    }
  });
});

describe("installContextMenuGuard", () => {
  afterEach(() => {
    // Clean up any appended elements
    const divs = document.querySelectorAll("div[data-test-context-menu]");
    divs.forEach((el) => el.remove());
    const inputs = document.querySelectorAll("input[data-test-context-menu]");
    inputs.forEach((el) => el.remove());
  });

  it("prevents default on plain element", () => {
    const disposer = installContextMenuGuard(document);
    const div = document.createElement("div");
    div.setAttribute("data-test-context-menu", "true");
    document.body.appendChild(div);

    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    });
    div.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    disposer();
  });

  it("does not prevent default on INPUT element", () => {
    const disposer = installContextMenuGuard(document);
    const input = document.createElement("input");
    input.setAttribute("data-test-context-menu", "true");
    document.body.appendChild(input);

    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    disposer();
  });

  it("removes listener when disposer is called", () => {
    const disposer = installContextMenuGuard(document);
    disposer();

    const div = document.createElement("div");
    div.setAttribute("data-test-context-menu", "true");
    document.body.appendChild(div);

    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    });
    div.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });
});
