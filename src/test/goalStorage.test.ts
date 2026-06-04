// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import {
  readGoalConfig,
  readGoalsOn,
  readGoalTarget,
  writeGoalConfig,
  writeGoalsOn,
  writeGoalTarget,
} from "../features/goals/goalStorage";

const PROJECT = "proj-storage-test";

afterEach(() => {
  localStorage.clear();
});

describe("readGoalConfig / writeGoalConfig — per-scope API", () => {
  it("returns on=false, target=0 for an unset chapter scope", () => {
    const cfg = readGoalConfig(PROJECT, "chapter");
    expect(cfg).toEqual({ on: false, target: 0 });
  });

  it("returns on=false, target=0 for an unset scene scope", () => {
    const cfg = readGoalConfig(PROJECT, "scene");
    expect(cfg).toEqual({ on: false, target: 0 });
  });

  it("roundtrips on=true, target=250 for chapter scope", () => {
    writeGoalConfig(PROJECT, "chapter", { on: true, target: 250 });
    const cfg = readGoalConfig(PROJECT, "chapter");
    expect(cfg).toEqual({ on: true, target: 250 });
  });

  it("roundtrips on=false, target=0 for scene scope", () => {
    writeGoalConfig(PROJECT, "scene", { on: false, target: 0 });
    const cfg = readGoalConfig(PROJECT, "scene");
    expect(cfg).toEqual({ on: false, target: 0 });
  });

  it("chapter and scene scopes are stored independently", () => {
    writeGoalConfig(PROJECT, "chapter", { on: true, target: 300 });
    writeGoalConfig(PROJECT, "scene", { on: false, target: 100 });
    expect(readGoalConfig(PROJECT, "chapter")).toEqual({ on: true, target: 300 });
    expect(readGoalConfig(PROJECT, "scene")).toEqual({ on: false, target: 100 });
  });

  it("different projects have independent configs for the same scope", () => {
    writeGoalConfig("proj-a", "chapter", { on: true, target: 500 });
    writeGoalConfig("proj-b", "chapter", { on: false, target: 200 });
    expect(readGoalConfig("proj-a", "chapter")).toEqual({ on: true, target: 500 });
    expect(readGoalConfig("proj-b", "chapter")).toEqual({ on: false, target: 200 });
  });

  it("writing manuscript scope also mirrors to legacy global keys", () => {
    writeGoalConfig(PROJECT, "manuscript", { on: true, target: 750 });
    // Legacy global readers should reflect the same value
    expect(readGoalsOn()).toBe(true);
    expect(readGoalTarget()).toBe(750);
  });
});

describe("readGoalConfig — manuscript scope back-compat fallback", () => {
  it("falls back to global target/on keys when no per-scope config exists", () => {
    writeGoalsOn(true);
    writeGoalTarget(400);
    // No per-scope config written — should read from global keys
    const cfg = readGoalConfig(PROJECT, "manuscript");
    expect(cfg).toEqual({ on: true, target: 400 });
  });

  it("per-scope config takes precedence over global keys when both exist", () => {
    writeGoalsOn(true);
    writeGoalTarget(400);
    writeGoalConfig(PROJECT, "manuscript", { on: false, target: 600 });
    // Per-scope config wins
    const cfg = readGoalConfig(PROJECT, "manuscript");
    expect(cfg).toEqual({ on: false, target: 600 });
  });
});

describe("legacy API (back-compat shims)", () => {
  it("writeGoalTarget / readGoalTarget roundtrip", () => {
    writeGoalTarget(500);
    expect(readGoalTarget()).toBe(500);
  });

  it("readGoalTarget returns 0 when not set", () => {
    expect(readGoalTarget()).toBe(0);
  });

  it("writeGoalsOn / readGoalsOn roundtrip — true", () => {
    writeGoalsOn(true);
    expect(readGoalsOn()).toBe(true);
  });

  it("writeGoalsOn / readGoalsOn roundtrip — false", () => {
    writeGoalsOn(false);
    expect(readGoalsOn()).toBe(false);
  });
});
