// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MenuDescriptor } from "../components/menu/ContextMenu";
import { ContextMenu } from "../components/menu/ContextMenu";

afterEach(cleanup);

/**
 * ContextMenu viewport-edge correction contract.
 *
 * The menu must clamp its rendered position so the box stays fully within
 * the viewport. Callers pass a raw (x, y) click position; the component
 * reads getBoundingClientRect() after layout (useLayoutEffect) and
 * recalculates if the box would overflow.
 *
 * Strategy: mock HTMLElement.prototype.getBoundingClientRect BEFORE render
 * so the value is already in place when useLayoutEffect fires on mount.
 */

describe("ContextMenu — viewport-edge position correction", () => {
  function makeMenu(x: number, y: number): MenuDescriptor {
    return { x, y, items: [{ label: "Action", onClick: vi.fn() }] };
  }

  it("clamps left when the menu would overflow the right edge", () => {
    // Viewport: 800 × 600. Menu box: 200 × 100. Pad: 10.
    // raw x = 700 → 700 + 200 + 10 = 910 > 800  → clamped to 800 − 200 − 10 = 590.
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 800 });
    Object.defineProperty(window, "innerHeight", { writable: true, configurable: true, value: 600 });

    const rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 200, height: 100, left: 0, top: 0, right: 200, bottom: 100, x: 0, y: 0,
      toJSON: () => ({}),
    });

    const onClose = vi.fn();
    const { container } = render(<ContextMenu menu={makeMenu(700, 50)} onClose={onClose} />);

    rectSpy.mockRestore();

    const cm = container.querySelector(".cm") as HTMLElement;
    // style.left is set to the clamped value by the layout effect.
    expect(Number(cm.style.left.replace("px", ""))).toBe(590);
  });

  it("clamps top when the menu would overflow the bottom edge", () => {
    // Viewport: 800 × 600. Menu box: 200 × 150. Pad: 10.
    // raw y = 500 → 500 + 150 + 10 = 660 > 600 → clamped to max(10, 600 − 150 − 10) = 440.
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 800 });
    Object.defineProperty(window, "innerHeight", { writable: true, configurable: true, value: 600 });

    const rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 200, height: 150, left: 0, top: 0, right: 200, bottom: 150, x: 0, y: 0,
      toJSON: () => ({}),
    });

    const onClose = vi.fn();
    const { container } = render(<ContextMenu menu={makeMenu(50, 500)} onClose={onClose} />);

    rectSpy.mockRestore();

    const cm = container.querySelector(".cm") as HTMLElement;
    expect(Number(cm.style.top.replace("px", ""))).toBe(440);
  });

  it("does not clamp position when the menu fits within the viewport", () => {
    // Viewport: 800 × 600. Menu box: 150 × 100. Pad: 10.
    // raw x = 100 → 100 + 150 + 10 = 260 ≤ 800 — no clamp.
    // raw y = 100 → 100 + 100 + 10 = 210 ≤ 600 — no clamp.
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 800 });
    Object.defineProperty(window, "innerHeight", { writable: true, configurable: true, value: 600 });

    const rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 150, height: 100, left: 100, top: 100, right: 250, bottom: 200, x: 100, y: 100,
      toJSON: () => ({}),
    });

    const onClose = vi.fn();
    const { container } = render(<ContextMenu menu={makeMenu(100, 100)} onClose={onClose} />);

    rectSpy.mockRestore();

    const cm = container.querySelector(".cm") as HTMLElement;
    // Position stays at the requested values — no clamping applied.
    expect(Number(cm.style.left.replace("px", ""))).toBe(100);
    expect(Number(cm.style.top.replace("px", ""))).toBe(100);
  });

  it("renders nothing when menu prop is null", () => {
    const onClose = vi.fn();
    const { container } = render(<ContextMenu menu={null} onClose={onClose} />);
    expect(container.querySelector(".cm")).toBeNull();
    expect(container.querySelector(".cm-backdrop")).toBeNull();
  });
});
