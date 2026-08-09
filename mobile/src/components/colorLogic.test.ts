import { describe, expect, it } from "vitest";

import { DARK, LIGHT } from "../theme/tokens";
import { resolveEntityColors, resolveLabelColors } from "./colorLogic";

describe("component color resolution", () => {
  it("resolves label tokens in both themes", () => {
    expect(resolveLabelColors(LIGHT, "clay")).toEqual({ foreground: LIGHT.label.clay, background: LIGHT.labelTint.clay });
    expect(resolveLabelColors(DARK, "sea")).toEqual({ foreground: DARK.label.sea, background: DARK.labelTint.sea });
  });

  it("falls back safely for unknown labels and entities", () => {
    expect(resolveLabelColors(LIGHT, "unknown")).toEqual({ foreground: LIGHT.colors.ink2, background: LIGHT.colors.parchmentDeep });
    expect(resolveEntityColors(DARK, "unknown")).toEqual({ foreground: DARK.colors.ink2, background: DARK.colors.parchmentDeep });
  });

  it("maps avatar entity types to theme colors", () => {
    expect(resolveEntityColors(LIGHT, "character").foreground).toBe(LIGHT.colors.character);
    expect(resolveEntityColors(DARK, "place").background).toBe(DARK.colors.locationTint);
  });
});
