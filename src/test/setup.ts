import "@testing-library/jest-dom/vitest";

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
