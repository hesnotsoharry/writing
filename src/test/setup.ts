import "@testing-library/jest-dom/vitest";

import { vi } from "vitest";

// @testing-library/dom v10 detects fake timers via `typeof jest !== 'undefined'`
// and advances the clock via `jest.advanceTimersByTime`. Vitest provides no
// global `jest`, so waitFor's polling setInterval is silently faked and never
// fires. This shim bridges the two: Vitest's fake-timer install sets
// `setTimeout.clock`, which satisfies jestFakeTimersAreEnabled(), and
// delegating advanceTimersByTime to vi makes the polling loop work.
(globalThis as unknown as Record<string, unknown>).jest = {
  advanceTimersByTime: vi.advanceTimersByTime.bind(vi),
};

// ResizeObserver is not implemented in jsdom. Stub it so TitleBar's
// useTitleBarCollapsed hook doesn't throw. The stub never fires its callback,
// so `collapsed` stays false and TitleBarActions renders normally in all tests.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
