// @vitest-environment jsdom
import type { Update } from "@tauri-apps/plugin-updater";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: vi.fn(),
}));

import { UpdateModal } from "../features/updater/UpdateModal";

afterEach(cleanup);

function makeUpdate(body?: string): Update {
  return {
    version: "0.12.9",
    currentVersion: "0.12.8",
    body,
    downloadAndInstall: vi.fn(),
  } as unknown as Update;
}

function renderModal(body?: string): void {
  render(
    <UpdateModal
      update={makeUpdate(body)}
      onDismiss={vi.fn()}
      onInstallError={vi.fn()}
    />,
  );
}

describe("UpdateModal release notes", () => {
  it("renders the existing title, subtitle, and actions with no notes region when body is missing", () => {
    renderModal(undefined);
    expect(screen.getByText("Update available")).toBeTruthy();
    expect(screen.getByText("Version 0.12.9 is ready to install.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /later/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /install & restart/i })).toBeTruthy();
    expect(document.querySelector(".upd-notes")).toBeNull();
  });

  it("does not render a notes region for empty, whitespace, or legacy placeholder bodies", () => {
    renderModal("");
    expect(document.querySelector(".upd-notes")).toBeNull();
    cleanup();

    renderModal("   ");
    expect(document.querySelector(".upd-notes")).toBeNull();
    cleanup();

    renderModal("Update to 0.12.9");
    expect(document.querySelector(".upd-notes")).toBeNull();
    expect(screen.queryByText("Update to 0.12.9")).toBeNull();
  });

  it("renders multiline notes as plain text and '- ' lines as a list", () => {
    renderModal("Crash fix.\n\n- Shows changelog\n- Scrolls long notes");
    expect(document.querySelector(".upd-notes")).not.toBeNull();
    expect(screen.getByText("Crash fix.")).toBeTruthy();
    expect(screen.getByText("Shows changelog")).toBeTruthy();
    expect(screen.getByText("Scrolls long notes")).toBeTruthy();
    expect(document.querySelectorAll(".upd-notes li")).toHaveLength(2);
  });

  it("never injects notes as HTML", () => {
    renderModal("<img src=x onerror=alert(1)>");
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeTruthy();
    expect(document.querySelector(".upd-notes img")).toBeNull();
  });
});
