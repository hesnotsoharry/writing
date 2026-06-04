// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AppShell } from "../shell/AppShell";

afterEach(cleanup);

describe("AppShell — slot→region layout contract", () => {
  it("renders titleBar at the top of .win (not inside .body)", () => {
    const { container } = render(
      <AppShell
        titleBar={<div data-testid="tb" />}
        binder={<div data-testid="binder" />}
        viewStage={<div data-testid="stage" />}
        inspector={<div data-testid="insp" />}
        statusBar={<div data-testid="sb" />}
      />
    );

    // titleBar must be present and outside .body
    expect(screen.getByTestId("tb")).toBeInTheDocument();
    expect(container.querySelector(".body [data-testid='tb']")).toBeNull();
  });

  it("renders binder inside .panel-binder", () => {
    const { container } = render(
      <AppShell
        titleBar={<div data-testid="tb" />}
        binder={<div data-testid="binder" />}
        viewStage={<div data-testid="stage" />}
        inspector={<div data-testid="insp" />}
        statusBar={<div data-testid="sb" />}
      />
    );

    const panelBinder = container.querySelector(".panel-binder");
    expect(panelBinder).not.toBeNull();
    expect(panelBinder).toContainElement(screen.getByTestId("binder"));
  });

  it("renders viewStage inside .center > .view-stage", () => {
    const { container } = render(
      <AppShell
        titleBar={<div data-testid="tb" />}
        binder={<div data-testid="binder" />}
        viewStage={<div data-testid="stage" />}
        inspector={<div data-testid="insp" />}
        statusBar={<div data-testid="sb" />}
      />
    );

    const viewStage = container.querySelector(".center .view-stage");
    expect(viewStage).not.toBeNull();
    expect(viewStage).toContainElement(screen.getByTestId("stage"));
  });

  it("renders inspector inside .panel-inspector", () => {
    const { container } = render(
      <AppShell
        titleBar={<div data-testid="tb" />}
        binder={<div data-testid="binder" />}
        viewStage={<div data-testid="stage" />}
        inspector={<div data-testid="insp" />}
        statusBar={<div data-testid="sb" />}
      />
    );

    const panelInspector = container.querySelector(".panel-inspector");
    expect(panelInspector).not.toBeNull();
    expect(panelInspector).toContainElement(screen.getByTestId("insp"));
  });

  it("renders statusBar at the bottom of .win (not inside .body)", () => {
    const { container } = render(
      <AppShell
        titleBar={<div data-testid="tb" />}
        binder={<div data-testid="binder" />}
        viewStage={<div data-testid="stage" />}
        inspector={<div data-testid="insp" />}
        statusBar={<div data-testid="sb" />}
      />
    );

    // statusBar must be present and outside .body
    expect(screen.getByTestId("sb")).toBeInTheDocument();
    expect(container.querySelector(".body [data-testid='sb']")).toBeNull();
  });

  it("renders root element with class .win", () => {
    const { container } = render(
      <AppShell
        titleBar={<div data-testid="tb" />}
        binder={<div data-testid="binder" />}
        viewStage={<div data-testid="stage" />}
        inspector={<div data-testid="insp" />}
        statusBar={<div data-testid="sb" />}
      />
    );

    expect(container.querySelector(".win")).not.toBeNull();
  });

  it("adds .anim to .win when anim prop is true", () => {
    const { container } = render(
      <AppShell
        titleBar={<div />} binder={<div />} viewStage={<div />}
        inspector={<div />} statusBar={<div />}
        anim={true}
      />
    );
    const win = container.querySelector(".win");
    expect(win).not.toBeNull();
    expect(win?.classList.contains("anim")).toBe(true);
  });

  it("does NOT add .anim to .win when anim prop is false", () => {
    const { container } = render(
      <AppShell
        titleBar={<div />} binder={<div />} viewStage={<div />}
        inspector={<div />} statusBar={<div />}
        anim={false}
      />
    );
    const win = container.querySelector(".win");
    expect(win).not.toBeNull();
    expect(win?.classList.contains("anim")).toBe(false);
  });

  it("does NOT add .anim to .win when anim prop is omitted", () => {
    const { container } = render(
      <AppShell
        titleBar={<div />} binder={<div />} viewStage={<div />}
        inspector={<div />} statusBar={<div />}
      />
    );
    const win = container.querySelector(".win");
    expect(win).not.toBeNull();
    expect(win?.classList.contains("anim")).toBe(false);
  });
});
