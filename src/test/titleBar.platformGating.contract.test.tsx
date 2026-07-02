// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { isMac } from "../shell/platform";
import { TitleBar } from "../shell/TitleBar";

// Tauri's os plugin injects the compile-time platform string under this key at
// load; `platform()` reads `window[OS_INTERNALS].platform` synchronously with
// no IPC round-trip (see @tauri-apps/plugin-os). Under jsdom the object is
// absent, so `platform()` throws and `isMac()`'s try/catch returns false — the
// Windows / non-Tauri path. The macOS-polarity test injects a "macos" value
// here to flip that path on without stubbing the module.
const OS_INTERNALS = "__TAURI_OS_PLUGIN_INTERNALS__";
type OsInternals = { platform: string };

function setOsInternals(value: OsInternals): void {
  (window as unknown as Record<string, OsInternals>)[OS_INTERNALS] = value;
}

function clearOsInternals(): void {
  delete (window as unknown as Record<string, OsInternals>)[OS_INTERNALS];
}

afterEach(() => {
  cleanup();
  // Strip any OS internals injected by the macOS-path test so the unmocked
  // Windows/default polarity never observes them, regardless of test order.
  clearOsInternals();
});

describe("TitleBar platform gating — inert on Windows, active on macOS", () => {
  it("isMac() returns false and the titlebar renders Windows window controls when the Tauri OS internals are absent (jsdom default)", () => {
    // No mock: jsdom has no Tauri runtime, so platform() throws → isMac() false.
    expect(isMac()).toBe(false);

    const { container } = render(<TitleBar view="editor" onViewChange={() => {}} />);

    const titlebar = container.querySelector(".titlebar");
    expect(titlebar).not.toBeNull();
    // No macOS chrome class is added on the Windows path.
    expect(titlebar?.className).not.toContain("titlebar--mac");
    // The .wbtns block renders WindowControls (min / max / close).
    expect(screen.getByRole("button", { name: /minimize/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /maximize/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument();
  });

  it("isMac() returns true, the titlebar gains the --mac modifier, and custom window controls are dropped when platform() reports 'macos'", () => {
    setOsInternals({ platform: "macos" });

    expect(isMac()).toBe(true);

    const { container } = render(<TitleBar view="editor" onViewChange={() => {}} />);

    const titlebar = container.querySelector(".titlebar");
    expect(titlebar).not.toBeNull();
    expect(titlebar?.className).toContain("titlebar--mac");
    // Native macOS traffic lights replace the .wbtns block — WindowControls is
    // not rendered.
    expect(screen.queryByRole("button", { name: /minimize/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /maximize/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /close/i })).toBeNull();
  });
});
